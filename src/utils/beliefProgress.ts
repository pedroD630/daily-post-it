/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Evidence counting and visual staging for beliefs.
 *
 * Evidence is DERIVED from the day history, never stored — the same choice
 * made for points (utils/points), streaks (utils/streakCalculator) and goal
 * frequency (utils/goalFrequency). Consequences, all of them wanted:
 *   - a task edited, deleted or un-completed corrects the count by itself;
 *   - refining a belief's keywords re-reads the whole history;
 *   - the count can never go negative or drift out of sync;
 *   - it matches on every device for free, because the days already sync.
 */

import { Belief, Day } from "../types";
import { taskMatchesBelief } from "./beliefMatching";

/** Evidence needed to fully break a belief. */
export const EVIDENCE_GOAL = 30;

export type BeliefStage = "rooted" | "questioning" | "weakening" | "broken";

export function getBeliefStage(evidenceCount: number): BeliefStage {
  if (evidenceCount >= EVIDENCE_GOAL) return "broken";
  if (evidenceCount >= 15) return "weakening";
  if (evidenceCount >= 5) return "questioning";
  return "rooted";
}

export function getProgressPercent(evidenceCount: number): number {
  return Math.min(100, (evidenceCount / EVIDENCE_GOAL) * 100);
}

export const STAGE_LABEL: Record<BeliefStage, string> = {
  rooted: "Enraizada",
  questioning: "Questionando",
  weakening: "Enfraquecendo",
  broken: "Quebrada",
};

/**
 * Counts evidence for every belief in one pass over the history.
 * Discarded (crumpled) days are skipped so a snapshot can't double-count.
 */
export function countEvidenceForBeliefs(
  beliefs: Belief[],
  allDays: Day[]
): Map<string, number> {
  const counts = new Map<string, number>(beliefs.map((b) => [b.id, 0]));
  for (const day of allDays) {
    if (day.discarded) continue;
    for (const task of day.tasks) {
      if (!task.completed || !task.text.trim()) continue;
      for (const belief of beliefs) {
        if (taskMatchesBelief(task.text, belief)) {
          counts.set(belief.id, (counts.get(belief.id) ?? 0) + 1);
        }
      }
    }
  }
  return counts;
}
