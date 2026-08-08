/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Belief keyword matching — same rules as goal matching (substring,
 * case- and accent-insensitive, minimum 3 chars). Reuses `normalize` from
 * goalMatching so the two features can never drift apart.
 */

import { Belief } from "../types";
import { normalize } from "./goalMatching";

export { normalize };

/** True when the task text contains at least one of the belief's keywords. */
export function taskMatchesBelief(taskText: string, belief: Belief): boolean {
  if (!taskText || !belief.keywords?.length) return false;
  const text = normalize(taskText);
  for (const kw of belief.keywords) {
    const needle = normalize(kw);
    if (needle.length >= 3 && text.includes(needle)) return true;
  }
  return false;
}

/**
 * Ids of every active belief the task text matches. A single task can count
 * as evidence against several beliefs at once.
 */
export function matchBeliefs(taskText: string, beliefs: Belief[]): string[] {
  const matched: string[] = [];
  for (const b of beliefs) {
    if (!b.active || b.deleted) continue;
    if (taskMatchesBelief(taskText, b)) matched.push(b.id);
  }
  return matched;
}
