/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Day, Settings } from "../types";

const DB_NAME = "postit_db";
const DB_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  postItColor: "#fef3c7", // Yellow Preset
  penColor: "#1f2937",    // Black Preset
  fontFamily: "sans-serif",
  paletteId: "pastel",
  paperTexture: true
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
