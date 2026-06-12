/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Day, Settings } from "../types";

const DB_NAME = "postit_db";
// v2: introduced "points_ledger" store
const DB_VERSION = 2;
const POINTS_BALANCE_KEY = "balance";

export const DEFAULT_SETTINGS: Settings = {
  postItColor: "#fef3c7", // Yellow Preset
  penColor: "#1f2937",    // Black Preset
  fontFamily: "sans-serif",
  paletteId: "pastel",
  paperTexture: true,
  theme: "system"
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

