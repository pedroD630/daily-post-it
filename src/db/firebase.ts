import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Day } from "../types";
import { saveDay } from "./index";
import { syncDayToSupabase } from "./supabase";

// Configuration resolved via environment variables, defaulting to applet credentials
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyAjCaP5heR61ILNLRUld9o-nl6LHAocwPQ",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0678919214",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:157708262678:web:b197c75798d31a0b6ec437",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0678919214.firebaseapp.com",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0678919214.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "157708262678",
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // Keep it exported for safety but we synchronize directly to Supabase now

const provider = new GoogleAuthProvider();
// Google Cal & Tasks scopes
provider.addScope("https://www.googleapis.com/auth/calendar.events");
provider.addScope("https://www.googleapis.com/auth/calendar.readonly");
provider.addScope("https://www.googleapis.com/auth/tasks");

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("google_access_token") : null;
let cachedCalendarSyncEnabled = true;

// Expiry Alert Subsystem
let cachedCalendarExpired = false;
const calendarExpiredListeners: Set<(expired: boolean) => void> = new Set();

export const isCalendarExpired = (): boolean => cachedCalendarExpired;

export const setCalendarExpired = (expired: boolean) => {
  cachedCalendarExpired = expired;
  calendarExpiredListeners.forEach((lis) => lis(expired));
};

export const subscribeCalendarExpired = (lis: (expired: boolean) => void) => {
  calendarExpiredListeners.add(lis);
  lis(cachedCalendarExpired);
  return () => {
    calendarExpiredListeners.delete(lis);
  };
};

// Listeners collection
const authListeners: Set<(user: User | null, token: string | null) => void> = new Set();

// Cache token in memory during active session
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    cachedAccessToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("google_access_token");
    }
    authListeners.forEach((lis) => lis(null, null));
  } else {
    if (!cachedAccessToken && typeof window !== "undefined") {
      cachedAccessToken = localStorage.getItem("google_access_token");
    }
    authListeners.forEach((lis) => lis(user, cachedAccessToken));
  }
});


export const initAuth = (
  onAuthChange: (user: User | null, token: string | null) => void
) => {
  authListeners.add(onAuthChange);
  // Send current state immediately
  onAuthChange(auth.currentUser, cachedAccessToken);
  return () => {
    authListeners.delete(onAuthChange);
  };
};

export const googleSignIn = (): Promise<void> => {
  isSigningIn = true;
  return signInWithPopup(auth, provider)
    .then((result) => {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        localStorage.setItem("google_access_token", credential.accessToken);
        setCalendarExpired(false);
        authListeners.forEach((lis) => lis(result.user, cachedAccessToken));
      }
    })
    .catch((err) => {
      console.error("Firebase Google Sign-In error:", err);
      throw err;
    })
    .finally(() => {
      isSigningIn = false;
    });
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("google_access_token");
  }
  setCalendarExpired(false);
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const isCalendarConnected = (): boolean => {
  return !!cachedAccessToken && cachedCalendarSyncEnabled;
};

export const setCalendarConnected = (connected: boolean) => {
  cachedCalendarSyncEnabled = connected;
};

/**
 * ----------------------------------------------------
 * CLOUD SYNCHRONIZATION (LOCAL INDEXEDDB + SUPABASE EXCLUSIVE)
 * ----------------------------------------------------
 */

const OFFLINE_QUEUE_KEY = "daily_postit_sync_queue";

interface SyncItem {
  dayId: string;
  timestamp: number;
}

function getOfflineQueue(): SyncItem[] {
  try {
    const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: SyncItem[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function addToOfflineQueue(dayId: string) {
  const queue = getOfflineQueue();
  if (!queue.some(item => item.dayId === dayId)) {
    queue.push({ dayId, timestamp: Date.now() });
    saveOfflineQueue(queue);
  }
}

/**
 * Cloud Sync single Day: Sync solely to Supabase
 */
export async function syncDayToCloud(day: Day): Promise<void> {
  const user = auth.currentUser;
  if (!user) return; // Only sync when logged in

  if (!navigator.onLine) {
    addToOfflineQueue(day.id);
    return;
  }

  try {
    // Sync solely to Supabase
    const success = await syncDayToSupabase(day, user.uid);
    if (!success) {
      throw new Error("Supabase sync failed");
    }

    // Successfully synced, remove from offline queue if it was in there
    const queue = getOfflineQueue();
    const updatedQueue = queue.filter(item => item.dayId !== day.id);
    saveOfflineQueue(updatedQueue);
  } catch (err) {
    console.error(`Failed to background-sync day ${day.id}:`, err);
    addToOfflineQueue(day.id);
  }
}

/**
 * Sync all unsynced local documents when back online
 */
export async function syncAllUnsyncedDays(): Promise<void> {
  const user = auth.currentUser;
  if (!user || !navigator.onLine) return;

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`Flushing ${queue.length} offline changes to Supabase...`);
  
  for (const item of queue) {
    const { getDay } = await import("./index");
    const localDay = await getDay(item.dayId);
    if (localDay) {
      await syncDayToCloud(localDay);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncAllUnsyncedDays();
  });
}

/**
 * Pull all days from Supabase Cloud upon login and sync to local IndexedDB
 */
export async function pullAllDaysFromCloud(): Promise<Day[]> {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const { pullAllDaysFromSupabase } = await import("./supabase");
    const cloudDays = await pullAllDaysFromSupabase(user.uid);

    for (const dayData of cloudDays) {
      await saveDay(dayData);
    }

    return cloudDays;
  } catch (err) {
    console.error("Failed to pull from Supabase cloud:", err);
    return [];
  }
}

/**
 * ----------------------------------------------------
 * GOOGLE CALENDAR READS (GET)
 * ----------------------------------------------------
 */

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

export async function fetchGoogleCalendarEvents(): Promise<CalendarEvent[]> {
  const token = await getAccessToken();
  if (!token || !cachedCalendarSyncEnabled) return [];

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(startOfToday)}&timeMax=${encodeURIComponent(endOfToday)}&singleEvents=true&orderBy=startTime`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.warn("Google Calendar request returned 401, token might be expired.");
        setCalendarExpired(true);
      }
      return [];
    }

    const data = await res.json();
    return (data.items || []) as CalendarEvent[];
  } catch (err) {
    console.error("Error fetching Google Calendar events:", err);
    return [];
  }
}
