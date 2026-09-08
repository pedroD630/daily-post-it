/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Outings grouped by month, newest first. The current month starts expanded.
 */

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Timer, PenLine, Pencil, FileCheck2 } from "lucide-react";
import { FieldEntry, MonthlyReport } from "../../types";
import { formatDuration, monthIdOf, monthLabel } from "../../utils/serviceYear";

interface Props {
  entries: FieldEntry[];
  reports: MonthlyReport[];
  onEditEntry: (entry: FieldEntry) => void;
}

export default function HistoryTab({ entries, reports, onEditEntry }: Props) {
  const currentMonth = monthIdOf();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const byMonth = new Map<string, FieldEntry[]>();
    for (const e of entries) {
      const id = e.date.slice(0, 7);
      const list = byMonth.get(id);
      if (list) list.push(e);
      else byMonth.set(id, [e]);
    }
    return Array.from(byMonth.entries())
      .map(([id, list]) => ({
        id,
        entries: list.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
        total: list.reduce((s, e) => s + e.minutes, 0),
      }))
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [entries]);

  const reportedIds = useMemo(() => new Set(reports.map((r) => r.id)), [reports]);

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-14 px-4 opacity-70">
        <Timer className="w-8 h-8 text-slate-400 mb-2" />
        <p className="text-sm text-slate-500">
          Nenhuma saída registrada ainda. Use o cronômetro ou o registro manual na aba Registro.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {grouped.map((group) => {
        // Current month defaults to open; every other month defaults to closed.
        const isOpen = collapsed[group.id] === undefined
          ? group.id === currentMonth
          : !collapsed[group.id];

        return (
          <section
            key={group.id}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [group.id]: isOpen }))}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
            >
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              <span className="flex-1 text-left text-sm font-semibold text-slate-800 dark:text-slate-100">
                {monthLabel(group.id)}
              </span>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                {formatDuration(group.total)}
              </span>
              {reportedIds.has(group.id) && (
                <FileCheck2 className="w-4 h-4 text-emerald-500 shrink-0" aria-label="Relatório gerado" />
              )}
            </button>

            {isOpen && (
              <ul className="border-t border-slate-100 dark:border-slate-800">
                {group.entries.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-slate-50 dark:border-slate-800/60">
                    {e.source === "timer"
                      ? <Timer className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-label="Cronômetro" />
                      : <PenLine className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-label="Manual" />}
                    <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                      {e.date.slice(8, 10)}/{e.date.slice(5, 7)}
                    </span>
                    <span className="flex-1 font-mono text-sm text-slate-800 dark:text-slate-100 tabular-nums">
                      {formatDuration(e.minutes)}
                    </span>
                    <button
                      type="button"
                      aria-label="Editar saída"
                      onClick={() => onEditEntry(e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
