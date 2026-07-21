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

// When the page loads after a signInWithRedirect (used only as fallback when
// the popup is blocked during an EXPLICIT user click), pick up the credential
// here. Runs once at module init; safely no-ops when there was no pending
// redirect.
if (typeof window !== "undefined") {
  getRedirectResult(auth)
    .then((result) => {
      if (!result) return;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        localStorage.setItem("google_access_token", credential.accessToken);
        setCalendarExpired(false);
        clearCalendarBackoff();
        authListeners.forEach((lis) => lis(result.user, cachedAccessToken));
      }
    })
    .catch((err) => {
      console.error("getRedirectResult error:", err);
    });
}

/**
 * Back-off gate for Google Calendar/Tasks API calls.
 *
 * When the access token 401s, we set a timestamp in localStorage and skip
 * ALL calendar/tasks calls until that window passes. This prevents the
 * app from hammering the API with dead-token requests every time the
 * user navigates between views (each 401 would previously trigger a
 * redirect-based reconnect and reload the page — awful UX).
 *
 * The user's Firebase identity is NOT affected: they stay logged in, the
 * app keeps working end-to-end. Only the optional Calendar sync is paused
 * until they explicitly click "Reconnect Calendar".
 */
const CALENDAR_BACKOFF_KEY = "google_calendar_backoff_until";
const CALENDAR_BACKOFF_MS = 10 * 60 * 1000; // 10 minutes

export function isCalendarInBackoff(): boolean {
  if (typeof localStorage === "undefined") return false;
  const until = Number(localStorage.getItem(CALENDAR_BACKOFF_KEY) || 0);
  return until > Date.now();
}

export function markCalendarBackoff() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CALENDAR_BACKOFF_KEY, String(Date.now() + CALENDAR_BACKOFF_MS));
}

export function clearCalendarBackoff() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CALENDAR_BACKOFF_KEY);
}

/**
 * Explicit user-triggered Calendar reconnect.
 *
 * ONLY called from a real click handler (Reconnect button). Uses popup
 * because popup + user gesture is reliable — never causes an
 * uncontrolled reload. If the popup is blocked despite the click
 * (edge case: aggressive popup blockers), we fall back to redirect,
 * but again: only after an explicit user click. The auto-reconnect-on-
 * every-401 behavior that was reloading the app is GONE.
 *
 * Returns true on success. On failure, throws so the caller can surface
 * a helpful message ("Popup blocked — click Reconnect again").
 */
export async function reconnectGoogleCalendar(): Promise<boolean> {
  if (!auth.currentUser) return false;

  const silentProvider = new GoogleAuthProvider();
  silentProvider.addScope("https://www.googleapis.com/auth/calendar.events");
  silentProvider.addScope("https://www.googleapis.com/auth/calendar.readonly");
  silentProvider.addScope("https://www.googleapis.com/auth/tasks");
  silentProvider.setCustomParameters({
    prompt: "none",
    login_hint: auth.currentUser.email || "",
  });

  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, silentProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      localStorage.setItem("google_access_token", credential.accessToken);
      setCalendarExpired(false);
      clearCalendarBackoff();
      authListeners.forEach((lis) => lis(result.user, cachedAccessToken));
      return true;
    }
    return false;
  } catch (err: any) {
    // If the popup was blocked, fall back to redirect. Redirect DOES
    // reload the page, but only after an explicit user click — matches
    // the mental model of "I asked to reconnect".
    if (err?.code === "auth/popup-blocked" || err?.code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, silentProvider);
      return false;
    }
    throw err;
  } finally {
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
  clearCalendarBackoff();
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
  clearCalendarBackoff();
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

    let wrote = 0;
    let skipped = 0;
    let recovered = 0;
    const skippedDetails: Array<{ id: string; localUpdated: number; cloudUpdated: number; localTasks: number; cloudTasks: number }> = [];

    for (const cloudDay of cloudDays) {
      const local = await getDay(cloudDay.id);
      const localUpdated = local?.updatedAt ?? 0;
      const cloudUpdated = cloudDay.updatedAt ?? 0;

      // RECOVERY PATH: local is an empty shell (no tasks, no note) AND cloud
      // has actual content. Always take cloud, regardless of timestamps.
      //
      // Why this matters: an older version of the code stamped the auto-
      // created "today" with updatedAt=Date.now(), which then permanently
      // blocked fresher cloud copies from overwriting (because the local
      // bogus stamp was always "newer" than the cloud's real creation
      // timestamp). This branch is what recovers users stuck in that state
      // without needing to clear browser data.
      const localIsEmptyShell =
        !local || (local.tasks.length === 0 && !local.note);
      const cloudHasContent =
        cloudDay.tasks.length > 0 || !!cloudDay.note;

      if (localIsEmptyShell && cloudHasContent) {
        await saveDay(cloudDay);
        wrote += 1;
        recovered += 1;
        continue;
      }

      // Standard last-write-wins by updatedAt. Cloud wins on equality so a
      // brand-new pull (both 0) still populates the IDB.
      if (cloudUpdated >= localUpdated) {
        await saveDay(cloudDay);
        wrote += 1;
      } else {
        skipped += 1;
        skippedDetails.push({
          id: cloudDay.id,
          localUpdated,
          cloudUpdated,
          localTasks: local?.tasks.length ?? 0,
          cloudTasks: cloudDay.tasks.length,
        });
      }
    }
    console.log(
      `[sync] cloud → local: pulled ${cloudDays.length} days, wrote ${wrote}` +
        (recovered ? ` (${recovered} recovered from empty-shell state)` : "") +
        `, skipped ${skipped} (local newer)`
    );
    if (skipped > 0) {
      console.log("[sync] skipped days (local was newer):", skippedDetails);
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
  // Respect the back-off window so we don't re-hammer the API every time
  // the user navigates a view while the token is dead.
  if (isCalendarInBackoff()) return [];

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
        // Token expired. Mark the calendar as needing a manual reconnect
        // and start the back-off window. NO redirect, NO reload — the
        // core app keeps working; only the optional Calendar feature is
        // paused until the user clicks Reconnect.
        console.warn("Google Calendar 401 — pausing calendar sync until user reconnects.");
        setCalendarExpired(true);
        markCalendarBackoff();
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
