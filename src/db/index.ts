/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Checkpoint, Day, Goal, Settings } from "../types";

const DB_NAME = "postit_db";
// v2: introduced "points_ledger" store
// v3: introduced "goals" store
// v4: introduced "ai_chat" store (single AI Coach conversation)
// v5: introduced "checkpoints" store (AI-proposed goal milestones)
const DB_VERSION = 5;
const POINTS_BALANCE_KEY = "balance";
const AI_CHAT_KEY = "default";

export const DEFAULT_SETTINGS: Settings = {
  postItColor: "#fef3c7", // Yellow Preset
  penColor: "#1f2937",    // Black Preset
  fontFamily: "sans-serif",
  paletteId: "pastel",
  paperTexture: true,
  theme: "system",
  geminiApiKey: undefined
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

export async function getDay(id: string): Promise<Day | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("days", "readonly");
    const store = transaction.objectStore("days");
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveDay(day: Day): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("days", "readwrite");
    const store = transaction.objectStore("days");
    const request = store.put(day);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllDays(): Promise<Day[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("days", "readonly");
    const store = transaction.objectStore("days");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
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
