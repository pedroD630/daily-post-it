/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Habit streak math. The streak is always derived from lastRelapseDate at
 * runtime, so it self-updates when the app is opened on a new day.
 */

const DAY_MS = 1000 * 60 * 60 * 24;

export function calculateStreak(lastRelapseDate: string): number {
  const last = new Date(lastRelapseDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  if (isNaN(last.getTime())) return 0;
  const diffMs = today.getTime() - last.getTime();
  return Math.max(0, Math.floor(diffMs / DAY_MS));
}

export interface StreakCheckpoint {
  days: number;
  reached: boolean;
}

export function getCheckpoints(streak: number): StreakCheckpoint[] {
  return [
    { days: 30, reached: streak >= 30 },
    { days: 60, reached: streak >= 60 },
    { days: 90, reached: streak >= 90 },
  ];
}

export function getProgressPercent(streak: number): number {
  return Math.min(100, (streak / 90) * 100);
}

export type StreakTier = "neutral" | "amber" | "green" | "gold";

/** Progress-bar color tier by streak length (per spec §5.3). */
export function getStreakTier(streak: number): StreakTier {
  if (streak >= 90) return "gold";
  if (streak >= 60) return "green";
  if (streak >= 30) return "amber";
  return "neutral";
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
