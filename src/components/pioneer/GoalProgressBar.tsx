/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { formatDuration } from "../../utils/serviceYear";

interface Props {
  icon: React.ReactNode;
  title: string;
  minutes: number;
  goalMinutes: number;
}

export default function GoalProgressBar({ icon, title, minutes, goalMinutes }: Props) {
  const pct = goalMinutes > 0 ? (minutes / goalMinutes) * 100 : 0;
  const reached = minutes >= goalMinutes;
  const remaining = Math.max(0, goalMinutes - minutes);

  const color = reached ? "#10b981" : pct >= 50 ? "#f59e0b" : "#94a3b8";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
          {icon}
          {title}
        </span>
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {formatDuration(minutes)} / {Math.round(goalMinutes / 60)}h
        </span>
      </div>

      <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      <span className="font-mono text-[11px] text-slate-400">
        {reached
          ? `Meta atingida ✓${minutes > goalMinutes ? ` · ${formatDuration(minutes - goalMinutes)} acima` : ""}`
          : `Faltam ${formatDuration(remaining)}`}
      </span>
    </div>
  );
}
