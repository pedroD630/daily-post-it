/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goal keyword matching — substring, case-insensitive, accent-insensitive.
 * No fuzzy/semantic matching: predictable, fully offline, free to run.
 *
 * We compute matches on the fly rather than persisting `matchedGoalIds`
 * on each task. This avoids re-scanning every existing task whenever a
 * goal's keyword list changes. The cost is negligible at our scale.
 */

import { Goal } from "../types";

// Unicode range U+0300..U+036F covers combining diacritical marks.
// NFD splits accented chars into base + diacritic, so this regex removes
// only the diacritics, leaving the base letter.
const DIACRITIC_RE = /[̀-ͯ]/g;

export function normalize(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIC_RE, "")
    .trim();
}

/**
 * True when the task text contains at least one of the goal's keywords.
 * Both the text and the keywords are normalized before comparison so
 * "vou ESTUDAR" matches the keyword "estudar" — same for accents.
 */
export function taskMatchesGoal(taskText: string, goal: Goal): boolean {
  if (!taskText || !goal.keywords?.length) return false;
  const text = normalize(taskText);
  for (const kw of goal.keywords) {
    const needle = normalize(kw);
    if (needle.length >= 3 && text.includes(needle)) return true;
  }
  return false;
}

/** Returns the ids of every goal the task currently matches. */
export function matchGoals(taskText: string, goals: Goal[]): string[] {
  const matched: string[] = [];
  for (const g of goals) {
    if (taskMatchesGoal(taskText, g)) matched.push(g.id);
  }
  return matched;
}
