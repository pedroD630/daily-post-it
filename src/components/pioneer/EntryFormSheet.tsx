/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Create or edit one field-service outing. Also used to confirm the duration
 * measured by the stopwatch, which is why the values arrive pre-filled.
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Trash2 } from "lucide-react";
import { FieldEntry } from "../../types";
import { toISODate } from "../../utils/serviceYear";
import ConfirmSheet from "../ConfirmSheet";

interface Props {
  open: boolean;
  initial: FieldEntry | null;
  /** Pre-filled duration coming from the stopwatch (minutes). */
  presetMinutes?: number;
  source: "timer" | "manual";
  onClose: () => void;
  onSave: (entry: FieldEntry) => void;
  onDelete?: (id: string) => void;
  /** Shown when deleting from a month whose report was already generated. */
  deleteWarning?: string;
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400";

export default function EntryFormSheet({
  open, initial, presetMinutes, source, onClose, onSave, onDelete, deleteWarning,
}: Props) {
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    const total = initial ? initial.minutes : presetMinutes ?? 0;
    setDate(initial?.date ?? today);
    setHours(Math.floor(total / 60));
    setMinutes(total % 60);
    setError(null);
  }, [open, initial, presetMinutes]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return setError("Informe a data.");
    if (date > today) return setError("A data não pode ser no futuro.");
    const h = Math.max(0, Math.min(23, Math.floor(hours) || 0));
    const m = Math.max(0, Math.min(59, Math.floor(minutes) || 0));
    const total = h * 60 + m;
    if (total <= 0) return setError("A duração precisa ser maior que zero.");

    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      date,
      minutes: total,
      createdAt: initial?.createdAt ?? Date.now(),
      source: initial?.source ?? source,
    });
  };

  return (
    <>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="entry-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.form
            key="entry-panel"
            onSubmit={submit}
            role="dialog"
            aria-modal
            aria-label={initial ? "Editar saída de campo" : "Registrar saída de campo"}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[61] mx-auto max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 shadow-2xl pt-3 max-h-[92vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-3 md:hidden" />
            <div className="px-5 pb-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-sans font-bold text-lg text-slate-900 dark:text-slate-100">
                  {initial ? "Editar saída" : "Registrar saída de campo"}
                </h3>
                <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Data</span>
                <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Duração</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={23} value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className={`${inputClass} tabular-nums`} aria-label="Horas"
                  />
                  <span className="text-sm text-slate-500 shrink-0">h</span>
                  <input
                    type="number" min={0} max={59} value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className={`${inputClass} tabular-nums`} aria-label="Minutos"
                  />
                  <span className="text-sm text-slate-500 shrink-0">min</span>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white shadow cursor-pointer">
                    Salvar
                  </button>
                </div>
                {initial && onDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="py-2 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir saída
                  </button>
                )}
              </div>
            </div>
          </motion.form>
        </>
      )}
    </AnimatePresence>

    {/* Outside the AnimatePresence above: ConfirmSheet brings its own, and
        nesting one inside an exiting subtree can stall the parent's unmount. */}
    {initial && onDelete && (
      <ConfirmSheet
        open={confirmDelete}
        title="Excluir esta saída de campo?"
        message={
          `${initial.date.split("-").reverse().join("/")} — ` +
          `${Math.floor(initial.minutes / 60)}h ${String(initial.minutes % 60).padStart(2, "0")}min` +
          (deleteWarning ? `\n\n${deleteWarning}` : "")
        }
        confirmLabel="Excluir"
        danger
        onConfirm={() => { setConfirmDelete(false); onDelete(initial.id); }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
}
