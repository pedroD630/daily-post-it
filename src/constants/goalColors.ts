/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Preset base colors for goal cards. The card overlays warm/cool tints on
 * top of these based on the active-vs-target frequency status.
 */

export interface GoalColor {
  id: string;
  name: string;
  hex: string;
}

export const GOAL_COLORS: GoalColor[] = [
  { id: "neutral",  name: "Neutral", hex: "#e5e7eb" }, // slate-200 — default
  { id: "indigo",   name: "Indigo",  hex: "#c7d2fe" }, // indigo-200
  { id: "emerald",  name: "Emerald", hex: "#a7f3d0" }, // emerald-200
  { id: "amber",    name: "Amber",   hex: "#fde68a" }, // amber-200
  { id: "rose",     name: "Rose",    hex: "#fecdd3" }, // rose-200
];

export const DEFAULT_GOAL_COLOR = GOAL_COLORS[0].hex;
