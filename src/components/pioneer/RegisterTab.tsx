/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Play, Square, Plus, BookOpen, CalendarDays, Target, FileText, Minus } from "lucide-react";
import { FieldEntry, MonthlyReport } from "../../types";
import {
  MONTHLY_GOAL_MINUTES, YEARLY_GOAL_MINUTES,
  getMonthTotal, getServiceYear, getServiceYearTotal, monthIdOf, monthLabel,
} from "../../utils/serviceYear";
import { getPendingMonth } from "../../utils/pendingReport";
import GoalProgressBar from "./GoalProgressBar";
import TimerDisplay from "./TimerDisplay";

interface Props {
  entries: FieldEntry[];
  reports: MonthlyReport[];
  bibleStudies: number;
  timerRunning: boolean;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onManualEntry: () => void;
  onBibleStudiesChange: (n: number) => void;
  onGenerateReport: (monthId: string) => void;
}

export default function RegisterTab({
  entries, reports, bibleStudies, timerRunning,
  onStartTimer, onStopTimer, onManualEntry, onBibleStudiesChange, onGenerateReport,
}: Props) {
  const currentMonth = monthIdOf();
  const serviceYear = getServiceYear();
  const monthMinutes = getMonthTotal(entries, currentMonth);
  const yearMinutes = getServiceYearTotal(entries, serviceYear);
  const pendingMonth = getPendingMonth(reports);

  return (
    <div className="flex flex-col gap-5">
      {/* Goals */}
      <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
        <GoalProgressBar
          icon={<Target className="w-4 h-4 text-amber-500" />}
          title={monthLabel(currentMonth)}
          minutes={monthMinutes}
          goalMinutes={MONTHLY_GOAL_MINUTES}
        />
        <GoalProgressBar
          icon={<CalendarDays className="w-4 h-4 text-sky-500" />}
          title={`Ano de serviço ${serviceYear.replace("-", "–")}`}
          minutes={yearMinutes}
          goalMinutes={YEARLY_GOAL_MINUTES}
        />
      </section>

      {/* Stopwatch */}
      <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm flex flex-col items-center gap-4">
        <TimerDisplay running={timerRunning} />
        {timerRunning ? (
          <button
            type="button"
            onClick={onStopTimer}
            className="w-full py-3 rounded-2xl bg-rose-600 text-white font-semibold shadow hover:bg-rose-700 cursor-pointer flex items-center justify-center gap-2"
          >
            <Square className="w-4 h-4" /> Encerrar cronômetro
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartTimer}
            className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold shadow hover:bg-slate-800 dark:hover:bg-white cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Iniciar cronômetro
          </button>
        )}
        <button
          type="button"
          onClick={onManualEntry}
          className="w-full py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Registrar manualmente
        </button>
      </section>

      {/* Bible studies */}
      <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />
          Estudos bíblicos este mês
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button" aria-label="Diminuir"
            onClick={() => onBibleStudiesChange(Math.max(0, bibleStudies - 1))}
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-center"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="font-mono text-lg tabular-nums w-7 text-center text-slate-800 dark:text-slate-100">{bibleStudies}</span>
          <button
            type="button" aria-label="Aumentar"
            onClick={() => onBibleStudiesChange(bibleStudies + 1)}
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Report */}
      <button
        type="button"
        disabled={!pendingMonth}
        onClick={() => pendingMonth && onGenerateReport(pendingMonth)}
        className={`w-full py-3 rounded-2xl font-semibold shadow flex items-center justify-center gap-2 ${
          pendingMonth
            ? "bg-sky-600 text-white hover:bg-sky-700 cursor-pointer"
            : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
        }`}
      >
        <FileText className="w-4 h-4" />
        {pendingMonth ? `Gerar relatório de ${monthLabel(pendingMonth)}` : "Todos os relatórios gerados"}
      </button>
    </div>
  );
}
