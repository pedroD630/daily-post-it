/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Point values per pen color. Compared case-insensitively because the user
 * can type custom hex codes that come back in various casings.
 */
export const POINT_VALUES: Record<string, number> = {
  "#1f2937": 5,   // black (default)
  "#2563eb": 7,   // blue
  "#dc2626": 10,  // red
};

const DEFAULT_POINT_VALUE = 5;

export function pointValue(penColor: string | undefined | null): number {
  if (!penColor) return DEFAULT_POINT_VALUE;
  return POINT_VALUES[penColor.toLowerCase()] ?? DEFAULT_POINT_VALUE;
}

/**
 * Format an integer balance for display, e.g. 1240 → "1.240" (pt-BR style)
 * to match the spec's UI mockup. Negative balances keep their sign.
 */
export function formatBalance(value: number): string {
  return value.toLocaleString("pt-BR");
}
