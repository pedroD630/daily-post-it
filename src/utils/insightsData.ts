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

import { Day, Task } from "../types";
import { extractKeywords, getTopKeywords } from "./keywordExtractor";

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

export function getPieChartData(
  allDays: Day[],
  periodStart: Date,
  statusFilter: StatusFilter
): PieDatum[] {
  const startTs = periodStart.getTime();

  // 1. Days within the period (ignore crumpled snapshots to avoid double count)
  const filteredDays = allDays.filter((day) => !day.discarded && dayStartMs(day.id) >= startTs);

  // 2. Tasks matching the status filter
  const tasks: Task[] = [];
  for (const day of filteredDays) {
    for (const task of day.tasks) {
      const include =
        statusFilter === "all" ||
        (statusFilter === "completed" && task.completed) ||
        (statusFilter === "incomplete" && !task.completed);
      if (include && task.text.trim().length > 0) tasks.push(task);
    }
  }

  // 3. Top 8 keywords + "outros"
  const freq = extractKeywords(tasks);
  const top = getTopKeywords(freq, 8);
  const totalTop = top.reduce((s, k) => s + k.count, 0);
  const totalAll = [...freq.values()].reduce((s, v) => s + v, 0);
  const others = totalAll - totalTop;

  const result: PieDatum[] = top.map((k) => ({ name: k.keyword, value: k.count }));
  if (others > 0) result.push({ name: "outros", value: others });
  return result;
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
