/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** A micro-step inside a composite task's checklist. */
export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

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
  /**
   * Checklist of micro-steps. When present and all are completed, the parent
   * task auto-completes. Hidden by default; toggled open in the TaskItem.
   */
  subtasks?: SubTask[];
  /**
   * Bumped by saveDay whenever this task's content changes. Drives the
   * per-task last-write-wins merge in pullAllDaysFromCloud, so two devices
   * editing different tasks on the same day no longer clobber each other.
   */
  updatedAt?: number;
  /**
   * Soft-delete tombstone. A task is only ever removed because it carries
   * this flag — never because some device simply didn't have it. Filtered
   * out by getDay/getAllDays, so the UI never sees tombstones.
   */
  deleted?: boolean;
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
  liquidGlass?: boolean; // Apple-style frosted translucent surfaces
}

export type AppView = "main" | "history" | "settings" | "profile" | "shop" | "insights" | "goals" | "streak" | "progress" | "beliefs";

/**
 * The user's daily affirmations, stored as a single ordered list under the
 * fixed key "list" (same single-record shape as the AI chat store).
 */
export interface AffirmationList {
  id: "list";
  items: string[];       // display order
  updatedAt?: number;    // last-write-wins for cross-device merge
}

/**
 * A negative belief the user wants to dismantle, paired with the healthier
 * statement that replaces it. Every completed task whose text matches one of
 * `keywords` counts as one "evidence" against the negative belief.
 *
 * Like Goal and Habit, the evidence count is NEVER stored — it is derived at
 * runtime from the day history (see utils/beliefProgress). That keeps it
 * self-healing (editing a task, crumpling a day, or refining keywords all
 * recompute correctly) and consistent across devices for free, since the
 * days already sync.
 */
export interface Belief {
  id: string;                    // crypto.randomUUID()
  negativeStatement: string;     // "Eu não sou suficiente."
  healthyStatement: string;      // "Meu valor não depende do meu pior hábito."
  keywords: string[];            // normalized, lowercase, trimmed, deduped
  createdAt: number;
  active: boolean;               // false = archived
  updatedAt?: number;            // last-write-wins for cross-device merge
  deleted?: boolean;             // tombstone — soft delete so deletions sync
}

/**
 * A habit the user wants to quit. The streak (days clean) is always derived
 * at runtime from lastRelapseDate — never stored as a counter.
 */
export interface Habit {
  id: string;                  // crypto.randomUUID()
  name: string;
  icon: string;                // emoji (defaults to 🔒)
  lastRelapseDate: string;     // "YYYY-MM-DD" — base for streak calc
  createdAt: number;
  active: boolean;             // false = archived
  updatedAt?: number;          // last-write-wins for cross-device merge
  deleted?: boolean;           // tombstone for soft-delete sync
}

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

/**
 * A milestone toward a goal. Usually proposed by the AI coach during a chat
 * (e.g. "save R$500/month" toward a "R$20k invested" goal) and accepted by
 * the user, but can be user-created too. When achieved, the coach can
 * propose an evolution (the next checkpoint).
 */
export interface Checkpoint {
  id: string;                    // crypto.randomUUID()
  goalId: string;                // the goal this milestone belongs to
  title: string;                 // e.g. "Guardar R$500 por mês"
  description?: string;          // optional detail / rationale
  achieved: boolean;
  achievedAt: number | null;
  createdAt: number;
  order: number;                 // sort within a goal
  source: "ai" | "user";         // who created it
  updatedAt?: number;            // last-write-wins for cross-device merge
  deleted?: boolean;             // tombstone — soft delete so deletions sync
}
