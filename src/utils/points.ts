/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Day } from "../types";

/**
 * Point values per pen color. Compared case-insensitively because the user
 * can type custom hex codes that come back in various casings.
 */
export const POINT_VALUES: Record<string, number> = {
  "#1f2937": 7,   // black (default)
  "#2563eb": 12,   // blue
  "#dc2626": 20,  // red
};

const DEFAULT_POINT_VALUE = 7;

export function pointValue(penColor: string | undefined | null): number {
  if (!penColor) return DEFAULT_POINT_VALUE;
  return POINT_VALUES[penColor.toLowerCase()] ?? DEFAULT_POINT_VALUE;
}

/**
 * Sum points across every completed task in every day. Derived directly
 * from the synced day records — no separate accumulator needed, no
 * last-write-wins race between devices.
 *
 * This is the foundation of the cross-device-safe points model:
 *   display_balance = computeTaskPoints(days) + ledger_adjustments
 * where the ledger only carries penalties and redemptions (rare events
 * that don't conflict in practice).
 */
export function computeTaskPoints(days: Day[]): number {
  let total = 0;
  for (const day of days) {
    if (day.discarded) continue; // crumpled snapshots don't double-count
    for (const task of day.tasks) {
      if (task.completed) total += pointValue(task.style.penColor);
    }
  }
  return total;
}

/**
 * Format an integer balance for display, e.g. 1240 → "1.240" (pt-BR style)
 * to match the spec's UI mockup. Negative balances keep their sign.
 */
export function formatBalance(value: number): string {
  return value.toLocaleString("pt-BR");
}
