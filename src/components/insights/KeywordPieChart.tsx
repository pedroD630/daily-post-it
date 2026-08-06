/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pie chart of the most frequent keywords across task text within a chosen
 * period and status filter. Recomputes live from `allDays` — no I/O.
 */

import React, { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Tag } from "lucide-react";
import { Day } from "../../types";
import {
  getPeriodStartDate,
  getPieChartData,
  PeriodUnit,
  StatusFilter,
} from "../../utils/insightsData";

const COLORS = [
  "#FFBB28", "#0088FE", "#FF8042", "#00C49F", "#FF6384",
  "#9966FF", "#FF9F40", "#4BC0C0", "#C9C9C9",
];

const controlClass =
  "text-xs rounded-lg border border-slate-300/70 dark:border-slate-700 " +
  "bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 " +
  "px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400/60";

export default function KeywordPieChart({ allDays }: { allDays: Day[] }) {
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState<PeriodUnit>("semana");
  const [status, setStatus] = useState<StatusFilter>("all");

  const data = useMemo(() => {
    const safeAmount = Math.min(365, Math.max(1, Math.floor(amount) || 1));
    const start = getPeriodStartDate(safeAmount, unit);
    return getPieChartData(allDays, start, status);
  }, [allDays, amount, unit, status]);

  return (
    <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm">
      <h3 className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
        <Tag className="w-4 h-4 text-amber-500" />
        Palavras-chave
      </h3>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Últimos
          <input
            type="number"
            min={1}
            max={365}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className={`${controlClass} w-16 tabular-nums`}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as PeriodUnit)}
            className={controlClass}
          >
            <option value="dia">dia(s)</option>
            <option value="semana">semana(s)</option>
            <option value="mês">mês(es)</option>
            <option value="ano">ano(s)</option>
          </select>
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className={controlClass}
          aria-label="Filtrar por status da tarefa"
        >
          <option value="all">Ambas</option>
          <option value="completed">Concluídas</option>
          <option value="incomplete">Não concluídas</option>
        </select>
      </div>

      {data.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-10">
          Nenhuma tarefa encontrada neste período.
        </p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry) => (entry as { name: string }).name}
                labelLine={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
