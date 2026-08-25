/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AffirmationList, Belief, Checkpoint, Day, Goal, Habit, Settings, Task } from "../types";
import { BELIEF_SEEDS } from "../constants/beliefs-seed";

const DB_NAME = "postit_db";
// v2: introduced "points_ledger" store
// v3: introduced "goals" store
// v4: introduced "ai_chat" store (single AI Coach conversation)
// v5: introduced "checkpoints" store (AI-proposed goal milestones)
// v6: introduced "habits" store (quit-habit streak tracker)
// v7: introduced "beliefs" store (belief breaker)
// v8: introduced "affirmations" store (single ordered list keyed by "list")
const DB_VERSION = 8;
const POINTS_BALANCE_KEY = "balance";
const AI_CHAT_KEY = "default";
const BELIEFS_SEEDED_KEY = "beliefs_seeded_v1";
const AFFIRMATIONS_KEY = "list";

/**
 * Optional starting points, offered one by one inside the editor.
 *
 * Deliberately NOT seeded into anyone's list. An affirmation is something
 * the person has to mean — shipping a fixed set and writing it into every
 * account presents one person's words as if they were universal. Nothing
 * lands in a user's list until they tap it themselves.
 *
 * Kept deliberately neutral for the same reason: anything tied to a
 * specific faith, family situation or diagnosis belongs to whoever writes
 * it, not to a default.
 */
export const SUGGESTED_AFFIRMATIONS: string[] = [
  "Meu valor é maior do que meu pior comportamento.",
  "Posso errar sem desistir.",
  "Meu cérebro pode aprender novos caminhos.",
  "Não preciso resolver toda minha vida hoje.",
  "Posso construir uma vida alinhada aos meus valores.",
  "Hoje escolho dar apenas o próximo passo.",
];

export const DEFAULT_SETTINGS: Settings = {
  postItColor: "#fef3c7", // Yellow Preset
  penColor: "#1f2937",    // Black Preset
  fontFamily: "sans-serif",
  paletteId: "pastel",
  paperTexture: true,
  theme: "system",
  geminiApiKey: undefined,
  liquidGlass: false
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB open error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("days")) {
        db.createObjectStore("days", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }
      // v2: single-record ledger keyed by "balance"
      if (!db.objectStoreNames.contains("points_ledger")) {
        db.createObjectStore("points_ledger", { keyPath: "id" });
      }
      // v3: long-term goals
      if (!db.objectStoreNames.contains("goals")) {
        db.createObjectStore("goals", { keyPath: "id" });
      }
      // v4: single AI Coach conversation, keyed by "default"
      if (!db.objectStoreNames.contains("ai_chat")) {
        db.createObjectStore("ai_chat", { keyPath: "id" });
      }
      // v5: AI-proposed goal milestones
      if (!db.objectStoreNames.contains("checkpoints")) {
        db.createObjectStore("checkpoints", { keyPath: "id" });
      }
      // v6: quit-habit streak tracker
      if (!db.objectStoreNames.contains("habits")) {
        db.createObjectStore("habits", { keyPath: "id" });
      }
      // v7: negative beliefs being dismantled by evidence
      if (!db.objectStoreNames.contains("beliefs")) {
        db.createObjectStore("beliefs", { keyPath: "id" });
      }
      // v8: daily affirmations, one ordered list keyed by "list"
      if (!db.objectStoreNames.contains("affirmations")) {
        db.createObjectStore("affirmations", { keyPath: "id" });
      }
    };
  });

  return dbPromise;
}

export async function getSettings(): Promise<Settings> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readonly");
    const store = transaction.objectStore("settings");
    const request = store.get("user_settings");

    request.onsuccess = () => {
      if (request.result) {
        // Backfill any fields added in later versions (e.g. paletteId, paperTexture)
        // so existing users don't end up with undefined values.
        const merged: Settings = { ...DEFAULT_SETTINGS, ...request.result };
        resolve(merged);
      } else {
        // Initialize default settings
        saveSettings(DEFAULT_SETTINGS)
          .then(() => resolve(DEFAULT_SETTINGS))
          .catch(reject);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");
    const request = store.put(settings, "user_settings");

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Strips soft-deleted tasks so nothing above the sync layer sees them. */
function withoutTombstones(day: Day): Day {
  if (!day.tasks?.some((t) => t.deleted)) return day;
  return { ...day, tasks: day.tasks.filter((t) => !t.deleted) };
}

/**
 * Raw read — tombstones included. Only the sync layer wants this; everything
 * else should use getDay/getAllDays.
 */
export async function getDayRaw(id: string): Promise<Day | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("days", "readonly");
    const store = transaction.objectStore("days");
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as Day) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllDaysRaw(): Promise<Day[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("days", "readonly");
    const store = transaction.objectStore("days");
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as Day[]) || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getDay(id: string): Promise<Day | null> {
  const raw = await getDayRaw(id);
  return raw ? withoutTombstones(raw) : null;
}

export async function getAllDays(): Promise<Day[]> {
  const raw = await getAllDaysRaw();
  return raw.map(withoutTombstones);
}

/** Everything on a task except the bookkeeping fields saveDay manages. */
function taskContentKey(t: Task): string {
  const { updatedAt, ...content } = t;
  return JSON.stringify(content);
}

/**
 * Persist a day, maintaining two invariants the sync layer depends on:
 *
 *  1. Tombstones survive. Callers hold React state that has already been
 *     stripped of deleted tasks; without carrying them over from the stored
 *     copy, the very next save would erase the record that a task was
 *     deleted, and the next pull would resurrect it.
 *  2. Every changed or new task gets a fresh `updatedAt`. Stamping here
 *     rather than in each of the six task handlers means no handler can
 *     forget, and an unchanged task keeps its old timestamp so it never
 *     wins a merge it shouldn't.
 */
export async function saveDay(day: Day): Promise<void> {
  const existing = await getDayRaw(day.id);
  const now = Date.now();

  const prevById = new Map((existing?.tasks ?? []).map((t) => [t.id, t]));
  const stampedTasks = (day.tasks ?? []).map((t) => {
    const prev = prevById.get(t.id);
    if (prev && taskContentKey(prev) === taskContentKey(t)) {
      return prev.updatedAt !== undefined ? { ...t, updatedAt: prev.updatedAt } : t;
    }
    return { ...t, updatedAt: now };
  });

  const incomingIds = new Set(stampedTasks.map((t) => t.id));
  const carriedTombstones = (existing?.tasks ?? []).filter(
    (t) => t.deleted && !incomingIds.has(t.id)
  );

  const toStore: Day = { ...day, tasks: [...stampedTasks, ...carriedTombstones] };

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("days", "readwrite");
    const store = transaction.objectStore("days");
    const request = store.put(toStore);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* -------------------------------------------------------------------------
 * Points ledger — single-record store holding the running balance.
 * Can be negative (penalties at midnight, post-due deductions).
 * ----------------------------------------------------------------------- */

interface PointsLedgerRow {
  id: "balance";
  balance: number;
  lastUpdated: number;
}

export async function getBalance(): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("points_ledger", "readonly");
    const store = tx.objectStore("points_ledger");
    const req = store.get(POINTS_BALANCE_KEY);
    req.onsuccess = () => {
      const row = req.result as PointsLedgerRow | undefined;
      resolve(row?.balance ?? 0);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Both the balance and the last-touch timestamp, for cloud-merge resolution. */
export async function getBalanceMeta(): Promise<{ balance: number; lastUpdated: number }> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("points_ledger", "readonly");
    const store = tx.objectStore("points_ledger");
    const req = store.get(POINTS_BALANCE_KEY);
    req.onsuccess = () => {
      const row = req.result as PointsLedgerRow | undefined;
      resolve({ balance: row?.balance ?? 0, lastUpdated: row?.lastUpdated ?? 0 });
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Overwrite balance with an explicit value (used after pulling from cloud).
 * Returns the value written.
 */
export async function setBalance(newBalance: number): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("points_ledger", "readwrite");
    const store = tx.objectStore("points_ledger");
    const row: PointsLedgerRow = {
      id: POINTS_BALANCE_KEY,
      balance: newBalance,
      lastUpdated: Date.now(),
    };
    const req = store.put(row);
    req.onsuccess = () => resolve(newBalance);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Atomically adjust the balance by `delta` (positive or negative) and return
 * the new value. Single-transaction so concurrent calls don't race.
 */
export async function applyPointsDelta(delta: number): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("points_ledger", "readwrite");
    const store = tx.objectStore("points_ledger");
    const getReq = store.get(POINTS_BALANCE_KEY);
    getReq.onsuccess = () => {
      const row = getReq.result as PointsLedgerRow | undefined;
      const current = row?.balance ?? 0;
      const next: PointsLedgerRow = {
        id: POINTS_BALANCE_KEY,
        balance: current + delta,
        lastUpdated: Date.now(),
      };
      const putReq = store.put(next);
      putReq.onsuccess = () => resolve(next.balance);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/* -------------------------------------------------------------------------
 * Goals — long-term targets that completed tasks match by keyword.
 * ----------------------------------------------------------------------- */

export async function getAllGoals(): Promise<Goal[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("goals", "readonly");
    const store = tx.objectStore("goals");
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as Goal[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getGoal(id: string): Promise<Goal | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("goals", "readonly");
    const store = tx.objectStore("goals");
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Goal) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGoal(goal: Goal): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("goals", "readwrite");
    const store = tx.objectStore("goals");
    const req = store.put(goal);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteGoalLocal(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("goals", "readwrite");
    const store = tx.objectStore("goals");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* -------------------------------------------------------------------------
 * AI Coach chat — single ongoing conversation, stored locally per device.
 * ----------------------------------------------------------------------- */

export interface AIChatMessageRecord {
  role: "user" | "model";
  text: string;
  ts: number;
}

interface AIChatRow {
  id: "default";
  messages: AIChatMessageRecord[];
}

export async function getAIChatHistory(): Promise<AIChatMessageRecord[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ai_chat", "readonly");
    const store = tx.objectStore("ai_chat");
    const req = store.get(AI_CHAT_KEY);
    req.onsuccess = () => {
      const row = req.result as AIChatRow | undefined;
      resolve(row?.messages ?? []);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveAIChatHistory(messages: AIChatMessageRecord[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ai_chat", "readwrite");
    const store = tx.objectStore("ai_chat");
    const row: AIChatRow = { id: AI_CHAT_KEY, messages };
    const req = store.put(row);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAIChatHistory(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ai_chat", "readwrite");
    const store = tx.objectStore("ai_chat");
    const req = store.delete(AI_CHAT_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}


/* -------------------------------------------------------------------------
 * Checkpoints — milestones toward a goal, usually AI-proposed.
 * ----------------------------------------------------------------------- */

export async function getAllCheckpoints(): Promise<Checkpoint[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("checkpoints", "readonly");
    const req = tx.objectStore("checkpoints").getAll();
    req.onsuccess = () => resolve((req.result as Checkpoint[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCheckpoint(cp: Checkpoint): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("checkpoints", "readwrite");
    const req = tx.objectStore("checkpoints").put(cp);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCheckpointLocal(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("checkpoints", "readwrite");
    const req = tx.objectStore("checkpoints").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* -------------------------------------------------------------------------
 * Habits — quit-habit streak tracker.
 * ----------------------------------------------------------------------- */

export async function getAllHabits(): Promise<Habit[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("habits", "readonly");
    const req = tx.objectStore("habits").getAll();
    req.onsuccess = () => resolve((req.result as Habit[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveHabit(habit: Habit): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("habits", "readwrite");
    const req = tx.objectStore("habits").put(habit);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteHabitLocal(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("habits", "readwrite");
    const req = tx.objectStore("habits").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Beliefs (v7) --------------------------------------------------------
// Note: evidence counts are NOT stored here. They are derived from the day
// history at render time (utils/beliefProgress) so they stay correct when
// tasks are edited, days are crumpled, or keywords are refined.

export async function getAllBeliefs(): Promise<Belief[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("beliefs", "readonly");
    const req = tx.objectStore("beliefs").getAll();
    req.onsuccess = () => resolve((req.result as Belief[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBelief(belief: Belief): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("beliefs", "readwrite");
    const req = tx.objectStore("beliefs").put(belief);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBeliefLocal(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("beliefs", "readwrite");
    const req = tx.objectStore("beliefs").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Runs the starter-belief insert at most once. Two guards, for two races:
 *
 *  - `seedGuard` (module-level) — loadInitialData runs on mount AND again at
 *    the end of refreshFromCloud, so two calls can both read an empty store
 *    before either writes. Without this they each insert the full set and the
 *    user opens the app to 16 beliefs instead of 8.
 *  - the localStorage flag, claimed BEFORE any await, covers reloads and other
 *    tabs, and keeps a user who deliberately deleted every belief from having
 *    them reappear on the next launch.
 */
let seedGuard: Promise<void> | null = null;

async function seedBeliefsOnce(): Promise<void> {
  if (localStorage.getItem(BELIEFS_SEEDED_KEY) === "done") return;
  const existing = await getAllBeliefs();
  if (existing.length > 0) {
    localStorage.setItem(BELIEFS_SEEDED_KEY, "done");
    return;
  }
  // Claim the seed synchronously — no await between check and set.
  localStorage.setItem(BELIEFS_SEEDED_KEY, "done");

  const now = Date.now();
  const seeded: Belief[] = BELIEF_SEEDS.map((s, i) => ({
    id: crypto.randomUUID(),
    negativeStatement: s.negativeStatement,
    healthyStatement: s.healthyStatement,
    keywords: s.keywords,
    createdAt: now + i, // preserves the authored order
    active: true,
    updatedAt: now + i,
    deleted: false,
  }));
  for (const b of seeded) await saveBelief(b);
}

/** Seeds on first run, then returns the current list. */
export async function seedBeliefsIfEmpty(): Promise<Belief[]> {
  if (!seedGuard) seedGuard = seedBeliefsOnce();
  await seedGuard;
  return getAllBeliefs();
}

// --- Affirmations (v8) ---------------------------------------------------

export const MAX_AFFIRMATIONS = 15;

export async function getAffirmationList(): Promise<AffirmationList | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("affirmations", "readonly");
    const req = tx.objectStore("affirmations").get(AFFIRMATIONS_KEY);
    req.onsuccess = () => resolve((req.result as AffirmationList) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAffirmationList(list: AffirmationList): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("affirmations", "readwrite");
    const req = tx.objectStore("affirmations").put(list);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Convenience wrapper: persists `items` under the fixed "list" key. */
export async function saveAffirmations(items: string[]): Promise<AffirmationList> {
  const list: AffirmationList = {
    id: AFFIRMATIONS_KEY,
    items: items.slice(0, MAX_AFFIRMATIONS),
    updatedAt: Date.now(),
  };
  await saveAffirmationList(list);
  return list;
}

/** The user's affirmations, or an empty list if they haven't written any. */
export async function getAffirmations(): Promise<AffirmationList> {
  const existing = await getAffirmationList();
  return existing ?? { id: AFFIRMATIONS_KEY, items: [], updatedAt: 0 };
}
