/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goals → Insights tab. Rule-based suggestions on top, per-goal 14-day
 * bar chart below. No AI — pure logic over IndexedDB data.
 *
 * Charts are drawn manually with motion/react rather than recharts to
 * avoid pulling ~80KB into the bundle for what amounts to colored bars.
 */

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Lightbulb, BarChart3 } from "lucide-react";
import { Day, Goal } from "../types";
import { dailyActionsForGoal } from "../utils/goalFrequency";
import { generateSuggestions } from "../utils/goalSuggestions";

interface GoalsInsightsPanelProps {
  goals: Goal[];        // include archived for historical charts
  allDays: Day[];
}

export default function GoalsInsightsPanel({ goals, allDays }: GoalsInsightsPanelProps) {
  const suggestions = useMemo(
    () => generateSuggestions(goals, allDays),
    [goals, allDays]
  );

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 px-4 opacity-70">
        <BarChart3 className="w-8 h-8 text-slate-400 mb-2" />
        <p className="text-sm text-slate-500">No goals yet. Add one in the Goals tab to start tracking.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section
          id="goal-insights-suggestions"
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm"
        >
          <h3 className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Suggestions
          </h3>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="text-sm text-slate-700 dark:text-slate-200 leading-snug pl-3 border-l-2 border-amber-400/70"
              >
                {s.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Per-goal frequency charts */}
      {goals.map((goal) => (
        <GoalChartCard key={goal.id} goal={goal} allDays={allDays} />
      ))}
    </div>
  );
}

function GoalChartCard({ goal, allDays }: { key?: React.Key; goal: Goal; allDays: Day[] }) {
  const bars = useMemo(() => dailyActionsForGoal(goal, allDays, 14), [goal, allDays]);
  const max = Math.max(1, ...bars.map((b) => b.count));
  const total = bars.reduce((s, b) => s + b.count, 0);

  return (
    <section
      id={`goal-chart-${goal.id}`}
      className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm ${
        goal.archived ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h4 className="font-sans font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
          {goal.title}
          {goal.archived && (
            <span className="ml-2 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-500">archived</span>
          )}
        </h4>
        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
          {total} in 14d
        </span>
      </div>

      <div className="flex items-end justify-between gap-1.5 h-24">
        {bars.map((bar, i) => (
          <div key={bar.dayId} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            {bar.count > 0 && (
              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 tabular-nums">{bar.count}</span>
            )}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(4, (bar.count / max) * 100)}%` }}
              transition={{ type: "spring", stiffness: 150, damping: 22, delay: 0.03 * i }}
              className="w-full max-w-5 rounded-t"
              style={{
                backgroundColor: bar.isToday
                  ? "#f59e0b"
                  : bar.count > 0
                  ? darken(goal.baseColor)
                  : "rgba(148,163,184,0.4)",
              }}
            />
            <span className={`text-[9px] font-mono ${
              bar.isToday ? "text-amber-600 font-bold" : "text-slate-400"
            }`}>
              {bar.shortLabel}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Slightly darken a pastel base color so the bars are visible on top of
 * the same color background. Drops lightness ~25% via HSL.
 */
function darken(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#475569";
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const darkenedL = Math.max(0.25, l - 0.25);
  // Approximation: scale each channel toward 0 by the darken delta.
  const scale = darkenedL / Math.max(0.01, l);
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v * scale * 255)))
    .toString(16)
    .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
