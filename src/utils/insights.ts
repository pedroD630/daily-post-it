/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure functions that turn the day records into productivity insights.
 * All date math is done in the user's local timezone using YYYY-MM-DD ids.
 */

import { Day } from "../types";

function localDateId(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * Map of dayId -> completed count. Discarded snapshots have suffixed ids
 * ("2026-05-22_discarded_...") — their base date still counts toward stats,
 * so we normalize ids to the leading YYYY-MM-DD.
 */
function completedByDate(days: Day[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const day of days) {
    const baseId = day.id.slice(0, 10);
    const completed = day.tasks.filter((t) => t.completed).length;
    map.set(baseId, (map.get(baseId) || 0) + completed);
  }
  return map;
}

/**
 * Current streak: consecutive days (walking backwards from today) with at
 * least one completed task. Today not being productive *yet* doesn't break
 * the streak — the chain is allowed to start at yesterday.
 */
export function computeStreak(days: Day[]): number {
  const byDate = completedByDate(days);
  const today = new Date();

  let streak = 0;
  let cursor = today;

  // If today has no completions yet, start counting from yesterday.
  if (!(byDate.get(localDateId(cursor)) ?? 0)) {
    cursor = shiftDays(cursor, -1);
  }

  while ((byDate.get(localDateId(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }

  return streak;
}

export interface WeekdayBar {
  /** Short weekday label, localized (e.g. "Mon" / "seg"). */
  label: string;
  /** YYYY-MM-DD. */
  dayId: string;
  completed: number;
  isToday: boolean;
}

/** Completed-task counts for the trailing 7 days (oldest first). */
export function computeWeeklyBars(days: Day[]): WeekdayBar[] {
  const byDate = completedByDate(days);
  const today = new Date();
  const bars: WeekdayBar[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = shiftDays(today, -i);
    const id = localDateId(d);
    bars.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
      dayId: id,
      completed: byDate.get(id) ?? 0,
      isToday: i === 0,
    });
  }
  return bars;
}

export interface InsightStats {
  totalCompleted: number;
  totalTasks: number;
  /** 0..100 over the trailing 30 days; null when no tasks in range. */
  completionRate30d: number | null;
  /** Best day ever: most completions in a single date. */
  bestDay: { dayId: string; count: number } | null;
}

export function computeStats(days: Day[]): InsightStats {
  let totalCompleted = 0;
  let totalTasks = 0;

  const cutoff = localDateId(shiftDays(new Date(), -30));
  let completed30 = 0;
  let total30 = 0;

  const byDate = completedByDate(days);
  let bestDay: { dayId: string; count: number } | null = null;
  byDate.forEach((count, dayId) => {
    if (count > 0 && (!bestDay || count > bestDay.count)) {
      bestDay = { dayId, count };
    }
  });

  for (const day of days) {
    const completed = day.tasks.filter((t) => t.completed).length;
    totalCompleted += completed;
    totalTasks += day.tasks.length;

    if (day.id.slice(0, 10) >= cutoff) {
      completed30 += completed;
      total30 += day.tasks.length;
    }
  }

  return {
    totalCompleted,
    totalTasks,
    completionRate30d: total30 > 0 ? Math.round((completed30 / total30) * 100) : null,
    bestDay,
  };
}
