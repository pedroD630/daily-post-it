/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goal frequency math — target normalization, actual counting, status.
 */

import { Day, Goal } from "../types";
import { taskMatchesGoal } from "./goalMatching";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Convert the user's chosen target into a weekly equivalent for comparison. */
export function toWeeklyTarget(amount: number, unit: "day" | "week" | "month"): number {
  switch (unit) {
    case "day":   return amount * 7;
    case "week":  return amount;
    case "month": return amount / 4.345; // avg weeks per month
  }
}

/**
 * Count completed, keyword-matched actions over the trailing 7 days
 * (rolling window, not calendar week).
 */
export function actualWeeklyFrequency(goal: Goal, allDays: Day[]): number {
  const since = Date.now() - 7 * DAY_MS;
  let count = 0;
  for (const day of allDays) {
    for (const task of day.tasks) {
      if (!task.completed) continue;
      if (!task.completedAt || task.completedAt < since) continue;
      if (taskMatchesGoal(task.text, goal)) count++;
    }
  }
  return count;
}

/**
 * Daily action counts for the trailing N days (newest last). Used by the
 * Insights bar chart. Discarded-suffixed dayIds normalize to their base
 * YYYY-MM-DD so a crumpled day still contributes to its calendar bucket.
 */
export interface GoalDailyBar {
  dayId: string;     // YYYY-MM-DD
  shortLabel: string;
  count: number;
  isToday: boolean;
}

export function dailyActionsForGoal(goal: Goal, allDays: Day[], days: number = 14): GoalDailyBar[] {
  const buckets = new Map<string, number>();
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(localDateId(d), 0);
  }

  for (const day of allDays) {
    const baseId = day.id.slice(0, 10);
    if (!buckets.has(baseId)) continue;
    for (const task of day.tasks) {
      if (!task.completed) continue;
      if (!taskMatchesGoal(task.text, goal)) continue;
      // Use completedAt's date for actual bucketing when available, so a
      // task completed across midnight lands in the right calendar day.
      const stampId = task.completedAt
        ? localDateId(new Date(task.completedAt))
        : baseId;
      if (buckets.has(stampId)) {
        buckets.set(stampId, (buckets.get(stampId) ?? 0) + 1);
      }
    }
  }

  const out: GoalDailyBar[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const id = localDateId(d);
    out.push({
      dayId: id,
      shortLabel: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1).toUpperCase(),
      count: buckets.get(id) ?? 0,
      isToday: i === 0,
    });
  }
  return out;
}

function localDateId(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type GoalStatus = "hot" | "neutral" | "cold";

export function getGoalStatus(actual: number, weeklyTarget: number): GoalStatus {
  if (weeklyTarget <= 0) return "neutral";
  const ratio = actual / weeklyTarget;
  if (ratio >= 1.0) return "hot";
  if (ratio >= 0.5) return "neutral";
  return "cold";
}

/** Returns the number of FULL days remaining until the goal deadline. Negative when past due. */
export function daysUntilDeadline(deadlineISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadlineISO + "T00:00:00");
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / DAY_MS);
}

/** Friendly "1y 11mo left" / "5d left" / "past due" string. */
export function formatDeadline(deadlineISO: string): string {
  const days = daysUntilDeadline(deadlineISO);
  if (days < 0) return "past due";
  if (days === 0) return "due today";
  if (days < 30) return `${days}d left`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo left`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths ? `${years}y ${remainingMonths}mo left` : `${years}y left`;
}

/**
 * When was the most recent action toward this goal? Returns null when none.
 * Useful for the "Last action: 2 days ago" line on the goal card.
 */
export function lastActionAt(goal: Goal, allDays: Day[]): number | null {
  let latest: number | null = null;
  for (const day of allDays) {
    for (const task of day.tasks) {
      if (!task.completed || !task.completedAt) continue;
      if (!taskMatchesGoal(task.text, goal)) continue;
      if (latest === null || task.completedAt > latest) latest = task.completedAt;
    }
  }
  return latest;
}

export function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  const days = Math.floor(diffMs / DAY_MS);
  if (days <= 0) {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours <= 0) return "just now";
    return `${hours}h ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
