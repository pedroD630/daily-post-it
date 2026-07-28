/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Semantic color language — single source of truth for what each accent
 * MEANS in the app, so a color reads consistently everywhere.
 *
 * Before this, amber meant three unrelated things (shop, a 30-day streak
 * tier, a warning) and each feature invented its own gradients. These roles
 * disambiguate intent. Prefer importing a role here over hard-coding a hex
 * or a one-off Tailwind color in new code.
 *
 * The matching CSS custom properties live in index.css (`--accent-*`), for
 * places that style via CSS rather than inline.
 */

export const SEMANTIC = {
  /** AI Coach / anything intelligence-related. */
  ai: { hex: "#6366f1", tw: "indigo" },       // indigo-500
  /** Streak tracker, SOS, gentle "at risk" tone. */
  streak: { hex: "#e11d48", tw: "rose" },     // rose-600
  /** Success, achieved checkpoints, completed. */
  success: { hex: "#10b981", tw: "emerald" }, // emerald-500
  /** Points, rewards shop. */
  points: { hex: "#f59e0b", tw: "amber" },    // amber-500
  /** Long-term goals. */
  goal: { hex: "#0ea5e9", tw: "sky" },        // sky-500
  /** Destructive / hard warnings. */
  danger: { hex: "#dc2626", tw: "red" },      // red-600
} as const;

export type SemanticRole = keyof typeof SEMANTIC;

export function semanticHex(role: SemanticRole): string {
  return SEMANTIC[role].hex;
}
