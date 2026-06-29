/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rule-based suggestion engine for the Goals → Insights tab.
 * Pure logic over the existing data, no AI calls. Returns at most 5 items,
 * prioritized in the order the spec defines.
 */

import { Day, Goal } from "../types";
import {
  actualWeeklyFrequency,
  daysUntilDeadline,
  getGoalStatus,
  lastActionAt,
  toWeeklyTarget,
} from "./goalFrequency";
import { taskMatchesGoal } from "./goalMatching";

export interface GoalSuggestion {
  id: string;
  goalId: string;
  text: string;
  /** Higher priority renders first. 1 = highest. */
  priority: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SUGGESTIONS = 5;

export function generateSuggestions(goals: Goal[], allDays: Day[]): GoalSuggestion[] {
  const active = goals.filter((g) => !g.archived);
  if (active.length === 0) return [];

  const suggestions: GoalSuggestion[] = [];

  // Pre-compute per-goal stats once
  const stats = active.map((g) => {
    const weeklyTarget = toWeeklyTarget(g.targetFrequency.amount, g.targetFrequency.unit);
    const last7 = actualWeeklyFrequency(g, allDays);
    const status = getGoalStatus(last7, weeklyTarget);
    const last = lastActionAt(g, allDays);
    const daysSinceLast = last !== null ? Math.floor((Date.now() - last) / DAY_MS) : Infinity;

    // Estimate "previous week" actions to detect "cold for 2+ weeks" / "hot for 2+ weeks"
    const since14 = Date.now() - 14 * DAY_MS;
    const since7 = Date.now() - 7 * DAY_MS;
    let prevWeek = 0;
    for (const day of allDays) {
      for (const t of day.tasks) {
        if (!t.completed || !t.completedAt) continue;
        if (t.completedAt < since14 || t.completedAt >= since7) continue;
        if (taskMatchesGoal(t.text, g)) prevWeek++;
      }
    }
    const prevStatus = getGoalStatus(prevWeek, weeklyTarget);
    const totalActions =
      last7 + prevWeek; // not exhaustive but enough for "no actions ever" check
    let totalAnyTime = 0;
    for (const day of allDays) {
      for (const t of day.tasks) {
        if (!t.completed) continue;
        if (taskMatchesGoal(t.text, g)) totalAnyTime++;
      }
    }
    const createdDaysAgo = Math.floor((Date.now() - g.createdAt) / DAY_MS);
    const deadlineDays = daysUntilDeadline(g.deadline);
    return {
      goal: g,
      weeklyTarget,
      last7,
      prevWeek,
      status,
      prevStatus,
      daysSinceLast,
      totalActions,
      totalAnyTime,
      createdDaysAgo,
      deadlineDays,
    };
  });

  // Rule 1: no action in >= 5 days
  for (const s of stats) {
    if (s.daysSinceLast >= 5 && s.daysSinceLast !== Infinity) {
      suggestions.push({
        id: `r1-${s.goal.id}`,
        goalId: s.goal.id,
        text: `Você não trabalha em "${s.goal.title}" há ${s.daysSinceLast} dias. Que tal um passo pequeno hoje?`,
        priority: 1,
      });
    }
  }

  // Rule 2: cold for 2+ weeks (current AND previous week both cold)
  for (const s of stats) {
    if (s.status === "cold" && s.prevStatus === "cold") {
      suggestions.push({
        id: `r2-${s.goal.id}`,
        goalId: s.goal.id,
        text: `"${s.goal.title}" está bem abaixo da meta há semanas. Vale revisar se o prazo ainda é realista.`,
        priority: 2,
      });
    }
  }

  // Rule 3: hot for 2+ consecutive weeks
  for (const s of stats) {
    if (s.status === "hot" && s.prevStatus === "hot") {
      suggestions.push({
        id: `r3-${s.goal.id}`,
        goalId: s.goal.id,
        text: `Você está arrasando em "${s.goal.title}"! Mantendo esse ritmo, você passa da meta.`,
        priority: 3,
      });
    }
  }

  // Rule 4: deadline within 30 days and status not hot
  for (const s of stats) {
    if (s.deadlineDays >= 0 && s.deadlineDays <= 30 && s.status !== "hot") {
      suggestions.push({
        id: `r4-${s.goal.id}`,
        goalId: s.goal.id,
        text: `Faltam ${s.deadlineDays} dias para "${s.goal.title}" e o ritmo atual não bate a meta. Considere intensificar.`,
        priority: 4,
      });
    }
  }

  // Rule 5: goal with zero actions ever, created 7+ days ago
  for (const s of stats) {
    if (s.totalAnyTime === 0 && s.createdDaysAgo >= 7) {
      const kws = s.goal.keywords.slice(0, 3).join(", ");
      suggestions.push({
        id: `r5-${s.goal.id}`,
        goalId: s.goal.id,
        text: `"${s.goal.title}" ainda não teve nenhuma ação registrada. Crie uma tarefa com uma das palavras-chave: ${kws}.`,
        priority: 5,
      });
    }
  }

  // Rule 6: overlap detection — two goals frequently sharing matched tasks
  // We count how many tasks (last 30 days) match BOTH goals simultaneously
  // and surface the highest-overlap pair if it has >= 3 shared completions.
  const overlapCounts = new Map<string, { a: Goal; b: Goal; n: number; sharedKeyword?: string }>();
  const since30 = Date.now() - 30 * DAY_MS;
  for (const day of allDays) {
    for (const t of day.tasks) {
      if (!t.completed || !t.completedAt || t.completedAt < since30) continue;
      const matched = active.filter((g) => taskMatchesGoal(t.text, g));
      if (matched.length < 2) continue;
      for (let i = 0; i < matched.length; i++) {
        for (let j = i + 1; j < matched.length; j++) {
          const a = matched[i];
          const b = matched[j];
          const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
          const prev = overlapCounts.get(key) ?? { a, b, n: 0 };
          prev.n += 1;
          // First overlapping keyword we can find for the suggestion text
          if (!prev.sharedKeyword) {
            const aKwSet = new Set(a.keywords.map((k) => k.toLowerCase()));
            const shared = b.keywords.find((k) => aKwSet.has(k.toLowerCase()));
            if (shared) prev.sharedKeyword = shared;
          }
          overlapCounts.set(key, prev);
        }
      }
    }
  }
  const topOverlap = [...overlapCounts.values()].sort((x, y) => y.n - x.n)[0];
  if (topOverlap && topOverlap.n >= 3 && topOverlap.sharedKeyword) {
    suggestions.push({
      id: `r6-${topOverlap.a.id}-${topOverlap.b.id}`,
      goalId: topOverlap.a.id,
      text: `Tarefas com "${topOverlap.sharedKeyword}" ajudam tanto "${topOverlap.a.title}" quanto "${topOverlap.b.title}" — dois objetivos, uma ação.`,
      priority: 6,
    });
  }

  // Sort by priority, then trim to the cap.
  suggestions.sort((a, b) => a.priority - b.priority);
  return suggestions.slice(0, MAX_SUGGESTIONS);
}
