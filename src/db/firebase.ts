import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
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
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || (typeof window !== "undefined" ? window.location.hostname : "gen-lang-client-0678919214.firebaseapp.com"),
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0678919214.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "157708262678",
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // Keep it exported for safety but we synchronize directly to Supabase now

// Persist session across browser restarts, suspend/resume, etc.
// browserLocalPersistence stores in IndexedDB, surviving long-term suspend.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Auth persistence setup failed (will fall back to in-memory):", err);
});

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

// Session-scoped guard so a failed silent re-auth doesn't put us in a redirect loop.
const AUTO_RECONNECT_FLAG = "google_auto_reconnect_attempted";

function clearAutoReconnectGuard() {
  try { sessionStorage.removeItem(AUTO_RECONNECT_FLAG); } catch { /* sessionStorage may be unavailable */ }
}

// When the page loads after a signInWithRedirect, pick up the credential here.
// Runs once at module init; safely no-ops when there was no pending redirect.
if (typeof window !== "undefined") {
  getRedirectResult(auth)
    .then((result) => {
      if (!result) return;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        localStorage.setItem("google_access_token", credential.accessToken);
        setCalendarExpired(false);
        clearAutoReconnectGuard(); // success → allow future auto-reconnects
        authListeners.forEach((lis) => lis(result.user, cachedAccessToken));
      }
    })
    .catch((err) => {
      console.error("getRedirectResult error:", err);
    });
}

/**
 * Silent re-auth attempt for when the Google access token has expired but the
 * Firebase session and the user's Google session are both still valid.
 *
 * Uses prompt='none' + login_hint to ask Google to skip the consent UI. If the
 * user is still signed in to Google and has previously granted these scopes,
 * Google returns immediately with a fresh access token via redirect — no UI
 * is shown, the page just briefly navigates and comes back.
 *
 * Falls through silently if:
 *  - Firebase session is gone (need full interactive login anyway)
 *  - A previous silent attempt already failed this session (avoid loop)
 *  - We're currently in another sign-in flow
 *
 * Caller is responsible for showing the manual reconnect UI as a fallback;
 * setCalendarExpired(true) should already have been called by the API layer.
 */
export async function tryAutoReconnect(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isSigningIn) return;
  if (!auth.currentUser) return;

  try {
    if (sessionStorage.getItem(AUTO_RECONNECT_FLAG) === "true") return;
    sessionStorage.setItem(AUTO_RECONNECT_FLAG, "true");
  } catch {
    // If sessionStorage is unavailable, skip auto-reconnect to be safe.
    return;
  }

  try {
    const silentProvider = new GoogleAuthProvider();
    silentProvider.addScope("https://www.googleapis.com/auth/calendar.events");
    silentProvider.addScope("https://www.googleapis.com/auth/calendar.readonly");
    silentProvider.addScope("https://www.googleapis.com/auth/tasks");
    silentProvider.setCustomParameters({
      prompt: "none",
      login_hint: auth.currentUser.email || ""
    });

    isSigningIn = true;
    // Browser will navigate away. The result is captured by getRedirectResult
    // on the next page load. If the user has no active Google session, Google
    // redirects back with an error in the URL hash; getRedirectResult will
    // reject and we leave the UI in calendar-expired state for manual action.
    await signInWithRedirect(auth, silentProvider);
  } catch (err) {
    console.warn("Auto-reconnect to Google failed; user will need to click reconnect:", err);
    isSigningIn = false;
  }
}


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

// Errors where the popup couldn't open or was dismissed before completing —
// in any of these cases we silently fall back to a full-page redirect, which is
// 100% reliable (no user-gesture timing constraints, works after long suspend).
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported"
]);

export const googleSignIn = (): Promise<void> => {
  isSigningIn = true;
  // Allow a future auto-reconnect to run again now that the user is taking action.
  clearAutoReconnectGuard();
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
      if (err && POPUP_FALLBACK_CODES.has(err.code)) {
        console.warn(`Popup auth failed (${err.code}); falling back to redirect.`);
        // signInWithRedirect returns a Promise that resolves to void and then
        // the browser navigates away. The result is picked up by getRedirectResult
        // on the next page load.
        return signInWithRedirect(auth, provider);
      }
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
 * Cloud Sync single Day to Supabase.
 *
 * IMPORTANT: queue-first design — the day is added to the offline queue
 * BEFORE the network call starts. If the page is closed mid-flight (reload
 * from auto-reconnect, tab swipe-killed, network blip), the day stays
 * queued and is re-pushed by syncAllUnsyncedDays on next boot. This is
 * what prevents the cross-device sync hole where a pull from cloud would
 * later clobber local changes that never made it to Supabase.
 */
export async function syncDayToCloud(day: Day): Promise<void> {
  const user = auth.currentUser;
  if (!user) return; // Only sync when logged in

  // Always queue first — covers offline AND in-flight interruption alike.
  addToOfflineQueue(day.id);

  if (!navigator.onLine) return;

  try {
    const success = await syncDayToSupabase(day, user.uid);
    if (!success) throw new Error("Supabase sync failed");

    // Sync confirmed by the server; safe to dequeue.
    const queue = getOfflineQueue();
    const updatedQueue = queue.filter(item => item.dayId !== day.id);
    saveOfflineQueue(updatedQueue);
  } catch (err) {
    console.error(`Failed to background-sync day ${day.id}:`, err);
    // Stays queued; next syncAllUnsyncedDays will retry.
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
 * Pull all days from Supabase Cloud and merge into IndexedDB.
 *
 * Last-write-wins by `updatedAt`: a cloud row only overwrites the local
 * copy when it is at least as fresh. If the user is currently typing on
 * this device the local row's updatedAt will be ahead of cloud — we skip
 * writing it, preserving the in-progress edit. The push side (via the
 * offline queue + handleTextChangeFinished) will eventually catch the
 * cloud up.
 *
 * Without this guard, a heartbeat or visibility refresh would clobber
 * mid-typing state with the pre-blur snapshot held in Supabase.
 */
export async function pullAllDaysFromCloud(): Promise<Day[]> {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const { pullAllDaysFromSupabase } = await import("./supabase");
    const { getDay } = await import("./index");
    const cloudDays = await pullAllDaysFromSupabase(user.uid);

    for (const cloudDay of cloudDays) {
      const local = await getDay(cloudDay.id);
      const localUpdated = local?.updatedAt ?? 0;
      const cloudUpdated = cloudDay.updatedAt ?? 0;
      // Tie-breaker: cloud wins on equality so a brand-new pull (both 0)
      // populates the IDB; only a strictly fresher local skips the write.
      if (cloudUpdated >= localUpdated) {
        await saveDay(cloudDay);
      }
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
        console.warn("Google Calendar request returned 401, token might be expired. Attempting silent reconnect.");
        setCalendarExpired(true);
        void tryAutoReconnect();
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
