/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Midnight penalty scheduler.
 *
 * Behavior:
 *  - Every minute, check whether we are within the first window of a new day
 *    AND we haven't already applied the penalty for that day's predecessor.
 *  - When triggered, sums the point values of incomplete tasks from
 *    yesterday (or today's record if still rolling over) and applies a
 *    negative delta via `onPenalty`.
 *  - Persists the last-penalized date in localStorage so reopening the app
 *    across midnight doesn't double-apply.
 *  - Also exposes a one-shot `checkMissedPenalty` to run on app boot, in
 *    case the device was asleep at midnight.
 */

import { Task } from "../types";
import { pointValue } from "./points";

const PENALTY_KEY = "postit_last_penalty_date";

function localDateId(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function yesterdayId(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateId(d);
}

function totalPenalty(tasks: Task[]): number {
  return tasks
    .filter((t) => !t.completed)
    .reduce((sum, t) => sum + pointValue(t.style.penColor), 0);
}

export interface PenaltySchedulerOptions {
  /** Returns today's tasks at call time (must be fresh, not memoized). */
  getTodayTasks: () => Task[];
  /** Called with a NEGATIVE delta when a penalty fires. */
  onPenalty: (delta: number) => Promise<void> | void;
}

/**
 * Starts the recurring scheduler. Returns a cleanup function.
 */
export function startPenaltyScheduler({
  getTodayTasks,
  onPenalty,
}: PenaltySchedulerOptions): () => void {
  const check = async () => {
    if (typeof localStorage === "undefined") return;
    const todayStr = localDateId(new Date());
    const last = localStorage.getItem(PENALTY_KEY);
    if (last === todayStr) return; // already penalized for "yesterday" today

    const now = new Date();
    // Run within the first 5 minutes of the new day to tolerate timers that
    // didn't fire exactly at 00:00 (sleeping laptop, throttled background tab).
    if (now.getHours() !== 0 || now.getMinutes() > 5) return;

    const tasks = getTodayTasks();
    const penalty = totalPenalty(tasks);
    if (penalty > 0) {
      await onPenalty(-penalty);
    }
    // Mark as run for this date regardless of whether penalty > 0, so we
    // don't keep checking all day.
    localStorage.setItem(PENALTY_KEY, todayStr);
  };

  // First check immediately in case the page loaded mid-window.
  void check();
  const interval = window.setInterval(() => {
    void check();
  }, 60_000);
  return () => window.clearInterval(interval);
}

/**
 * One-shot recovery: if the app was closed at midnight, check whether
 * yesterday's incomplete tasks were penalized. Call once on app boot,
 * after loading today's record from IDB.
 *
 * The penalty applies to yesterday's day-record (or whatever record matches
 * the yesterdayId). If the record can't be loaded (offline, first-day user),
 * this no-ops gracefully.
 */
export async function checkMissedPenalty(
  loadDay: (id: string) => Promise<{ tasks: Task[] } | null>,
  onPenalty: (delta: number) => Promise<void> | void,
): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const todayStr = localDateId(new Date());
  const last = localStorage.getItem(PENALTY_KEY);
  if (last === todayStr) return; // already settled

  const ymd = yesterdayId();
  const day = await loadDay(ymd);
  if (!day) {
    // Nothing to penalize (no record for yesterday). Still mark today so we
    // don't re-check on every reload during the day.
    localStorage.setItem(PENALTY_KEY, todayStr);
    return;
  }

  const penalty = totalPenalty(day.tasks);
  if (penalty > 0) {
    await onPenalty(-penalty);
  }
  localStorage.setItem(PENALTY_KEY, todayStr);
}
