/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Which month still needs a report.
 *
 * Reports are filed in arrears — you hand in September's during the first
 * days of October — so this returns the OLDEST unreported month of the
 * current service year, not the month we happen to be in.
 */

import { MonthlyReport } from "../types";
import { getServiceYear, getServiceYearRange } from "./serviceYear";

/** Every month of the current service year that has already begun. */
export function elapsedMonthsOfServiceYear(now: Date = new Date()): string[] {
  const { start } = getServiceYearRange(getServiceYear(now));
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= limit) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function getPendingMonth(
  reports: MonthlyReport[],
  now: Date = new Date()
): string | null {
  const reported = new Set(reports.map((r) => r.id));
  return elapsedMonthsOfServiceYear(now).find((m) => !reported.has(m)) ?? null;
}
