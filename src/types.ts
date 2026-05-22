/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Task {
  id: string;            // unique identifier (e.g. crypto.randomUUID())
  text: string;
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
  style: {
    penColor: string;    // hex snapshot
    fontFamily: string;  // snapshot at task creation
  };
}

export interface Day {
  id: string;            // ISO date string "YYYY-MM-DD"
  date: string;          // Display format "dd/mm/yy"
  createdAt: number;     // Unix timestamp
  discarded: boolean;    // true if crumpled before end of day
  discardedAt: number | null;
  style: {
    postItColor: string; // hex snapshot
  };
  tasks: Task[];
}

export interface Settings {
  postItColor: string;   // hex (preset or custom)
  penColor: string;      // hex (black, blue, red)
  fontFamily: string;    // default, elegant, handwritten
}

export type AppView = "main" | "history" | "settings";
