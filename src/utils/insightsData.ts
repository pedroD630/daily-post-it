/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Data aggregation for the enhanced Insights charts. All computed in-memory
 * over the `allDays` array already held in App state — no I/O, no network.
 *
 * Note on day ids: normal days are "YYYY-MM-DD"; crumpled snapshots have a
 * suffix ("YYYY-MM-DD_discarded_..."). We slice the leading 10 chars for the
 * calendar date, and parse with a local "T00:00:00" suffix to avoid the UTC
 * off-by-one that `new Date("YYYY-MM-DD")` introduces.
 */

import { Day, Goal, Task } from "../types";
import { normalize } from "./goalMatching";

export type PeriodUnit = "dia" | "semana" | "mês" | "ano";
export type StatusFilter = "all" | "completed" | "incomplete";

export interface PieDatum { name: string; value: number; }
export interface LineDataPoint { label: string; value: number; }

function baseId(id: string): string {
  return id.slice(0, 10);
}
function dayStartMs(id: string): number {
  const d = new Date(baseId(id) + "T00:00:00");
  return d.getTime();
}
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getPeriodStartDate(amount: number, unit: PeriodUnit): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  switch (unit) {
    case "dia":    now.setDate(now.getDate() - amount); break;
    case "semana": now.setDate(now.getDate() - amount * 7); break;
    case "mês":    now.setMonth(now.getMonth() - amount); break;
    case "ano":    now.setFullYear(now.getFullYear() - amount); break;
  }
  return now;
}

function matchesStatus(task: Task, statusFilter: StatusFilter): boolean {
  return (
    statusFilter === "all" ||
    (statusFilter === "completed" && task.completed) ||
    (statusFilter === "incomplete" && !task.completed)
  );
}

/** Every distinct goal tag, normalized for matching and kept for display. */
export function collectGoalTags(goals: Goal[]): Array<{ needle: string; label: string }> {
  const seen = new Map<string, string>();
  for (const goal of goals) {
    for (const kw of goal.keywords ?? []) {
      const needle = normalize(kw);
      // Same floor goal matching uses — a tag too short to match a goal
      // would never match here either, so it is left out rather than
      // shown as a permanent zero.
      if (needle.length < 3 || seen.has(needle)) continue;
      seen.set(needle, kw.trim() || needle);
    }
  }
  return [...seen.entries()].map(([needle, label]) => ({ needle, label }));
}

/**
 * How often each goal tag appears in task text over the chosen period.
 *
 * The tags are read straight off the goals, using the same normalize +
 * substring rule as goalMatching, so the slices are exactly the tags the
 * goals themselves recognise. Registering a new tag on a goal makes it
 * eligible immediately; it only shows up once a task in the period uses
 * it, and tags nobody used are dropped instead of drawn as empty slices.
 *
 * A task counts once for every distinct tag it contains, so the slices
 * measure tag usage rather than splitting a total.
 */
export function getGoalTagPieData(
  allDays: Day[],
  goals: Goal[],
  periodStart: Date,
  statusFilter: StatusFilter
): PieDatum[] {
  const tags = collectGoalTags(goals);
  if (tags.length === 0) return [];

  const startTs = periodStart.getTime();
  const counts = new Map<string, number>();

  for (const day of allDays) {
    // Skip crumpled snapshots so a discarded day can't double-count.
    if (day.discarded || dayStartMs(day.id) < startTs) continue;
    for (const task of day.tasks) {
      if (!matchesStatus(task, statusFilter)) continue;
      const text = normalize(task.text);
      if (!text) continue;
      for (const { needle } of tags) {
        if (text.includes(needle)) counts.set(needle, (counts.get(needle) ?? 0) + 1);
      }
    }
  }

  return tags
    .map(({ needle, label }) => ({ name: label, value: counts.get(needle) ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

function completedOn(allDays: Day[], id: string): number {
  return allDays
    .filter((d) => !d.discarded && baseId(d.id) === id)
    .reduce((sum, d) => sum + d.tasks.filter((t) => t.completed).length, 0);
}

export function getWeeklyProductivity(allDays: Day[]): LineDataPoint[] {
  const result: LineDataPoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const id = toISODate(d);
    result.push({
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      value: completedOn(allDays, id),
    });
  }
  return result;
}

export function getMonthlyProductivity(allDays: Day[]): LineDataPoint[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: LineDataPoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const id = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    result.push({ label: String(d), value: completedOn(allDays, id) });
  }
  return result;
}

export function getYearlyProductivity(allDays: Day[]): LineDataPoint[] {
  const today = new Date();
  const year = today.getFullYear();
  const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const result: LineDataPoint[] = [];
  for (let m = 0; m < 12; m++) {
    const prefix = `${year}-${String(m + 1).padStart(2, "0")}`;
    const count = allDays
      .filter((day) => !day.discarded && baseId(day.id).startsWith(prefix))
      .reduce((sum, day) => sum + day.tasks.filter((t) => t.completed).length, 0);
    result.push({ label: MONTHS_PT[m], value: count });
  }
  return result;
}
