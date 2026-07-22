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
  order: number;         // sort index
  style: {
    penColor: string;    // hex snapshot
    fontFamily: string;  // snapshot at task creation
  };
  calendarTaskId?: string;
  calendarEventId?: string;
  time?: string;          // optional HH:MM time
  reminderMinutes?: number; // default options: 10 | 30 | 60 | 1440
}

export interface Day {
  id: string;            // ISO date string "YYYY-MM-DD"
  date: string;          // Display format "dd/mm/yy"
  createdAt: number;     // Unix timestamp
  discarded: boolean;    // true if crumpled before end of day
  discardedAt: number | null;
  style: {
    postItColor: string;     // hex snapshot
    paperTexture?: boolean;  // snapshot of "paper texture" setting at creation time
  };
  tasks: Task[];
  note?: string;         // free-form scratchpad text for the day
  /**
   * Wall-clock timestamp bumped on every LOCAL mutation. Used by
   * pullAllDaysFromCloud to skip overwriting a row that is fresher
   * locally than what the cloud reflects — fixes the bug where typing
   * was clobbered by a background refresh pulling the pre-blur snapshot.
   */
  updatedAt?: number;
}

export type ThemeMode = "light" | "dark" | "system";

export interface Settings {
  postItColor: string;   // hex (preset or custom)
  penColor: string;      // hex (black, blue, red)
  fontFamily: string;    // default, elegant, handwritten
  paletteId: string;     // ID of the active color palette (see constants/palettes.ts)
  paperTexture: boolean; // whether to render the realistic shader-based paper texture
  theme: ThemeMode;      // app-wide color scheme preference
  geminiApiKey?: string; // BYOK for AI Insights (fallback when Chrome Built-in AI not available)
}

export type AppView = "main" | "history" | "settings" | "profile" | "shop" | "insights" | "goals";

/**
 * Long-term goal a user is tracking. Each completed task whose text matches
 * (substring, case- and accent-insensitive) any of `keywords` counts as one
 * "action" toward this goal.
 */
export interface Goal {
  id: string;                    // crypto.randomUUID()
  title: string;
  deadline: string;              // ISO date "YYYY-MM-DD"
  keywords: string[];            // normalized, lowercase, trimmed, deduped
  targetFrequency: {
    amount: number;
    unit: "day" | "week" | "month";
  };
  baseColor: string;             // hex, defaults to neutral gray
  createdAt: number;
  archived: boolean;             // soft-delete; archived hides from active list
  updatedAt?: number;            // last-write-wins for cross-device merge
}
