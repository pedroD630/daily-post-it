/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goal card — title, deadline, weekly progress bar, hype/cold icon and
 * warm/cool tint based on actual-vs-target frequency.
 */

import React from "react";
import { Flame, Snowflake, Clock3, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Day, Goal } from "../types";
import {
  actualWeeklyFrequency,
  formatDeadline,
  formatRelative,
  getGoalStatus,
  lastActionAt,
  toWeeklyTarget,
  GoalStatus,
} from "../utils/goalFrequency";

interface GoalCardProps {
  // React 19 + TS in this project doesn't auto-strip `key` from JSX props;
  // declaring it here keeps strict TypeScript happy at the call sites.
  key?: React.Key;
  goal: Goal;
  allDays: Day[];
  onClick?: () => void;
  /** Ask the AI coach for steps toward this goal (seeds the chat). */
  onAskSteps?: (goal: Goal) => void;
}

const TINT_BY_STATUS: Record<GoalStatus, string> = {
  hot:     "linear-gradient(135deg, rgba(255,100,50,0.22), rgba(255,100,50,0.04) 60%, transparent)",
  neutral: "linear-gradient(135deg, transparent, transparent)",
  cold:    "linear-gradient(135deg, rgba(70,130,200,0.20), rgba(70,130,200,0.04) 60%, transparent)",
};

export default function GoalCard({ goal, allDays, onClick, onAskSteps }: GoalCardProps) {
  const weeklyTarget = toWeeklyTarget(goal.targetFrequency.amount, goal.targetFrequency.unit);
  const actual = actualWeeklyFrequency(goal, allDays);
  const status = getGoalStatus(actual, weeklyTarget);
  const last = lastActionAt(goal, allDays);

  // Progress bar: clamp display percentage at 100 visually, but keep a tiny
  // float-up animation so the user sees motion when the bar fills.
  const fillRatio = weeklyTarget > 0 ? Math.min(actual / weeklyTarget, 1) : 0;
  const fillPct = Math.round(fillRatio * 100);

  const StatusIcon =
    status === "hot" ? Flame : status === "cold" ? Snowflake : null;
  const statusIconColor =
    status === "hot" ? "#dc2626" : status === "cold" ? "#3b82f6" : "#94a3b8";

  return (
    <div
      id={`goal-card-${goal.id}`}
      className="relative w-full text-left rounded-2xl p-4 border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      style={{
        backgroundColor: goal.baseColor,
        backgroundImage: TINT_BY_STATUS[status],
      }}
    >
      {/* Dark-mode contrast overlay.
          The base pastel + warm/cool tint are designed for light mode. In
          dark mode they leave the light secondary text (slate-300) sitting
          on a near-white background, which loses contrast. This semi-
          transparent slate-900 layer darkens the card just enough to
          restore legibility while preserving the underlying tint color
          (hot/cold cue stays visible). Hidden in light mode. */}
      <span
        aria-hidden="true"
        className="hidden dark:block absolute inset-0 pointer-events-none"
        style={{ backgroundColor: "rgba(15, 23, 42, 0.42)", borderRadius: "inherit" }}
      />

      {/* Content wrapper — `relative` makes the children share the same
          positioned layer as the overlay above, and DOM order then puts
          them visually on top (CSS positioned-element painting rule). */}
      <div className="relative">

      {/* Clickable body opens the goal editor. Kept separate from the
          "ask AI" action so we avoid nesting interactive elements. */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`Abrir ${goal.title}`}
        className="block w-full text-left cursor-pointer"
      >

      {/* Title row + status icon */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {StatusIcon && (
            <StatusIcon
              className="w-4 h-4 shrink-0"
              style={{ color: statusIconColor }}
              fill={status === "hot" ? "currentColor" : "none"}
            />
          )}
          <span className="font-sans font-bold text-base text-slate-900 dark:text-slate-100 truncate">
            {goal.title}
          </span>
        </div>
        {goal.archived && (
          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-500 shrink-0">
            archived
          </span>
        )}
      </div>

      {/* Deadline + last action */}
      <div className="flex items-center justify-between gap-3 mb-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
        <span className="truncate">{formatDeadline(goal.deadline)}</span>
        {last !== null && (
          <span className="flex items-center gap-1 opacity-75">
            <Clock3 className="w-3 h-3" />
            {formatRelative(last)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            backgroundColor: status === "hot" ? "#dc2626" : status === "cold" ? "#3b82f6" : "#475569",
          }}
        />
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 tabular-nums">
          {actual} / {Math.max(1, Math.round(weeklyTarget))} <span className="opacity-60">per week</span>
        </span>
        {status === "hot" && <span className="text-[10px] font-mono text-rose-600 font-bold">on fire</span>}
        {status === "cold" && <span className="text-[10px] font-mono text-blue-600 font-bold">falling behind</span>}
      </div>

      </button>

      {/* Discoverable entry point to the AI checkpoint flow */}
      {onAskSteps && !goal.archived && (
        <button
          type="button"
          onClick={() => onAskSteps(goal)}
          className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-white/60 dark:bg-slate-900/40 hover:bg-white/90 dark:hover:bg-slate-900/70 border border-indigo-200/60 dark:border-indigo-800/40 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Pedir etapas à IA
        </button>
      )}

      </div>{/* /content wrapper */}
    </div>
  );
}
