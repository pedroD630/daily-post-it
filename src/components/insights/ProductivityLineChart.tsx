/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Line chart of completed tasks over time, at three granularities
 * (week / month / year). A dashed reference line marks the average.
 * Recomputes live from `allDays` — no I/O.
 */

import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Day } from "../../types";
import {
  getWeeklyProductivity,
  getMonthlyProductivity,
  getYearlyProductivity,
} from "../../utils/insightsData";

type Granularity = "semana" | "mês" | "ano";
const TABS: Granularity[] = ["semana", "mês", "ano"];
const TAB_LABEL: Record<Granularity, string> = {
  semana: "Semana",
  "mês": "Mês",
  ano: "Ano",
};

export default function ProductivityLineChart({ allDays }: { allDays: Day[] }) {
  const [granularity, setGranularity] = useState<Granularity>("semana");

  const data = useMemo(() => {
    switch (granularity) {
      case "semana": return getWeeklyProductivity(allDays);
      case "mês":    return getMonthlyProductivity(allDays);
      case "ano":    return getYearlyProductivity(allDays);
    }
  }, [allDays, granularity]);

  const average = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((s, d) => s + d.value, 0) / data.length;
  }, [data]);

  const xInterval = granularity === "mês" ? 4 : 0;

  return (
    <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm">
      <h3 className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        Produtividade
      </h3>

      {/* Granularity tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setGranularity(tab)}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
              granularity === tab
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
            <XAxis
              dataKey="label"
              interval={xInterval}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "none",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
              formatter={(v: number) => [v, "Concluídas"]}
            />
            <ReferenceLine
              y={average}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{
                value: `média ${average.toFixed(1)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: "#f59e0b",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3, fill: "#10b981" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
