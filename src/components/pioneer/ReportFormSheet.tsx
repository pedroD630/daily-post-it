/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Confirms the figures before the S-4-T PDF is produced.
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, FileDown } from "lucide-react";
import { formatDuration } from "../../utils/serviceYear";

interface Props {
  open: boolean;
  monthLabel: string;
  totalMinutes: number;
  initialName: string;
  initialStudies: number;
  onClose: () => void;
  onGenerate: (data: { name: string; bibleStudies: number; notes: string }) => void;
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400";

export default function ReportFormSheet({
  open, monthLabel, totalMinutes, initialName, initialStudies, onClose, onGenerate,
}: Props) {
  const [name, setName] = useState("");
  const [studies, setStudies] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setStudies(initialStudies);
    setNotes("");
    setError(null);
  }, [open, initialName, initialStudies]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Informe seu nome.");
    onGenerate({ name: name.trim(), bibleStudies: Math.max(0, Math.floor(studies) || 0), notes });
  };

  const wholeHours = Math.floor(totalMinutes / 60);
  const leftover = totalMinutes % 60;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="report-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.form
            key="report-panel"
            onSubmit={submit}
            role="dialog"
            aria-modal
            aria-label={`Relatório de ${monthLabel}`}
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
                  Relatório de {monthLabel}
                </h3>
                <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Nome</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" className={inputClass} />
              </label>

              <div className="flex flex-col gap-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Horas</span>
                <span className="font-mono text-lg text-slate-800 dark:text-slate-100 tabular-nums">{wholeHours}</span>
                <span className="text-[11px] text-slate-500 leading-relaxed">
                  Total registrado: {formatDuration(totalMinutes)}.
                  {leftover > 0 && ` O formulário oficial pede horas inteiras, então os ${leftover} min restantes não entram no PDF.`}
                </span>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Estudos bíblicos</span>
                <input type="number" min={0} value={studies} onChange={(e) => setStudies(Number(e.target.value))} className={`${inputClass} tabular-nums`} />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Observações</span>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className={`${inputClass} resize-none`} />
              </label>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white shadow cursor-pointer flex items-center justify-center gap-1.5">
                  <FileDown className="w-4 h-4" /> Gerar PDF
                </button>
              </div>
            </div>
          </motion.form>
        </>
      )}
    </AnimatePresence>
  );
}
