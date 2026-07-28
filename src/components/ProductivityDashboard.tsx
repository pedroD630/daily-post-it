/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Productivity dashboard — streak hero, 7-day completion chart, lifetime
 * stats and points. Extracted from the old standalone InsightsView so the
 * unified Progress hub can show it without duplicating the AI chat.
 */

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Flame, CheckCircle2, Target, Trophy, Sparkles } from "lucide-react";
import { Day } from "../types";
import { computeStreak, computeWeeklyBars, computeStats } from "../utils/insights";
import { formatBalance } from "../utils/points";

interface Props {
  allDays: Day[];
  pointsBalance: number;
}

export default function ProductivityDashboard({ allDays, pointsBalance }: Props) {
  const streak = useMemo(() => computeStreak(allDays), [allDays]);
  const bars = useMemo(() => computeWeeklyBars(allDays), [allDays]);
  const stats = useMemo(() => computeStats(allDays), [allDays]);

  const maxBar = Math.max(1, ...bars.map((b) => b.completed));
  const weekTotal = bars.reduce((sum, b) => sum + b.completed, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Streak hero */}
      <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-300 dark:from-orange-600 dark:via-amber-600 dark:to-yellow-600 shadow-lg text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.05 }}
          className="flex flex-col items-center gap-1"
        >
          <Flame className="w-10 h-10 text-white drop-shadow" fill="currentColor" />
          <span className="font-mono text-5xl font-bold text-white drop-shadow-sm tabular-nums">{streak}</span>
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-white/85">dias seguidos</span>
          <span className="font-sans text-[11px] text-white/75 mt-1">
            {streak === 0 ? "Conclua uma tarefa hoje para começar!" : streak === 1 ? "Bom começo — volte amanhã!" : `Você foi produtivo ${streak} dias seguidos.`}
          </span>
        </motion.div>
      </div>

      {/* Weekly chart */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-3xl p-5 shadow-sm">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Últimos 7 dias</h3>
          <span className="font-mono text-[11px] text-slate-400">{weekTotal} concluída{weekTotal === 1 ? "" : "s"}</span>
        </div>
        <div className="flex items-end justify-between gap-2 h-28">
          {bars.map((bar, i) => (
            <div key={bar.dayId} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              {bar.completed > 0 && <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">{bar.completed}</span>}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(6, (bar.completed / maxBar) * 100)}%` }}
                transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.06 * i }}
                className={`w-full max-w-7 rounded-t-lg ${
                  bar.isToday ? "bg-gradient-to-t from-amber-500 to-amber-300"
                  : bar.completed > 0 ? "bg-gradient-to-t from-slate-400 to-slate-300 dark:from-slate-600 dark:to-slate-500"
                  : "bg-slate-200/80 dark:bg-slate-800"
                }`}
              />
              <span className={`text-[9px] font-mono uppercase ${bar.isToday ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-400"}`}>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} label="Concluídas (total)" value={String(stats.totalCompleted)} />
        <StatTile icon={<Target className="w-4 h-4 text-sky-500" />} label="Conclusão 30 dias" value={stats.completionRate30d !== null ? `${stats.completionRate30d}%` : "—"} />
        <StatTile icon={<Trophy className="w-4 h-4 text-amber-500" />} label="Melhor dia" value={stats.bestDay ? `${stats.bestDay.count} tarefas` : "—"} hint={stats.bestDay ? stats.bestDay.dayId : undefined} />
        <StatTile icon={<Sparkles className="w-4 h-4 text-purple-500" />} label="Saldo de pontos" value={`${formatBalance(pointsBalance)} pts`} alert={pointsBalance < 0} />
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, hint, alert }: { icon: React.ReactNode; label: string; value: string; hint?: string; alert?: boolean; }) {
  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <span className={`font-mono text-xl font-bold tabular-nums ${alert ? "text-red-500" : "text-slate-800 dark:text-slate-100"}`}>{value}</span>
      {hint && <span className="font-mono text-[9px] text-slate-400">{hint}</span>}
    </div>
  );
}
