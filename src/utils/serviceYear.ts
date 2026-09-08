/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Service-year arithmetic. A service year runs 1 September → 31 August, so
 * August and September of the same calendar year belong to different ones.
 */

import { FieldEntry } from "../types";

export const MONTHLY_GOAL_MINUTES = 50 * 60;   // 50 h
export const YEARLY_GOAL_MINUTES = 600 * 60;   // 600 h

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Local "YYYY-MM-DD" — never toISOString, which shifts the day in UTC-3. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthIdOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "Setembro 2026" */
export function monthLabel(monthId: string): string {
  const [y, m] = monthId.split("-").map(Number);
  return `${MONTHS_PT[(m || 1) - 1]} ${y}`;
}

export function getServiceYear(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed, 8 = September
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function getServiceYearRange(serviceYear: string): { start: Date; end: Date } {
  const [startY, endY] = serviceYear.split("-").map(Number);
  return {
    start: new Date(startY, 8, 1, 0, 0, 0, 0),
    end: new Date(endY, 7, 31, 23, 59, 59, 999),
  };
}

export function getMonthTotal(entries: FieldEntry[], monthId: string): number {
  return entries
    .filter((e) => e.date.startsWith(monthId))
    .reduce((sum, e) => sum + e.minutes, 0);
}

export function getServiceYearTotal(entries: FieldEntry[], serviceYear: string): number {
  const { start, end } = getServiceYearRange(serviceYear);
  return entries
    .filter((e) => {
      // Parse as local midnight; new Date("2026-09-01") would be UTC.
      const d = new Date(e.date + "T00:00:00");
      return d >= start && d <= end;
    })
    .reduce((sum, e) => sum + e.minutes, 0);
}

export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}
