/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Create / edit a habit in a bottom sheet.
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Trash2 } from "lucide-react";
import { Habit } from "../types";
import { todayISO } from "../utils/streakCalculator";
import ConfirmSheet from "./ConfirmSheet";

interface Props {
  open: boolean;
  initial: Habit | null; // null = create
  onClose: () => void;
  onSave: (habit: Habit) => void;
  onDelete?: (id: string) => void;
}

const ICON_PRESETS = ["🔒", "🚭", "📵", "🍺", "🎰", "🍔", "☕", "🍬", "🕹️", "💊"];

export default function HabitFormSheet({ open, initial, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🔒");
  const [lastRelapse, setLastRelapse] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setIcon(initial.icon || "🔒");
      setLastRelapse(initial.lastRelapseDate);
    } else {
      setName("");
      setIcon("🔒");
      setLastRelapse(todayISO());
    }
    setError(null);
  }, [open, initial]);

  const today = todayISO();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError("O nome precisa de pelo menos 2 caracteres.");
    if (!lastRelapse) return setError("Informe a data da última recaída.");
    if (lastRelapse > today) return setError("A data não pode ser no futuro.");

    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: trimmed,
      icon,
      lastRelapseDate: lastRelapse,
      createdAt: initial?.createdAt ?? Date.now(),
      active: initial?.active ?? true,
      updatedAt: Date.now(),
      deleted: false,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="habitform-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.form
            key="habitform-panel"
            onSubmit={submit}
            role="dialog"
            aria-modal
            aria-label={initial ? "Editar hábito" : "Novo hábito"}
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
                  {initial ? "Editar hábito" : "Novo hábito"}
                </h3>
                <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Name */}
              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Nome</span>
                <input
                  id="habit-form-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Cigarro, Redes sociais…"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </label>

              {/* Icon */}
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Ícone</span>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_PRESETS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      aria-label={`Ícone ${em}`}
                      onClick={() => setIcon(em)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-transform cursor-pointer ${
                        icon === em ? "border-slate-800 dark:border-white scale-105 bg-slate-50 dark:bg-slate-800" : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Last relapse date */}
              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Data da última recaída</span>
                <input
                  id="habit-form-lastrelapse"
                  type="date"
                  value={lastRelapse}
                  max={today}
                  onChange={(e) => setLastRelapse(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
                <span className="text-[10px] font-mono text-slate-400">
                  Se nunca teve recaída, use a data de hoje — o streak conta a partir daí.
                </span>
              </label>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white shadow cursor-pointer">
                    {initial ? "Salvar" : "Criar"}
                  </button>
                </div>
                {initial && onDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="py-2 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir hábito
                  </button>
                )}
              </div>
            </div>
          </motion.form>

          {initial && onDelete && (
            <ConfirmSheet
              open={confirmDelete}
              title={`Excluir o hábito "${initial.name}"?`}
              message="O histórico deste hábito será removido."
              confirmLabel="Excluir"
              danger
              onConfirm={() => { setConfirmDelete(false); onDelete(initial.id); }}
              onCancel={() => setConfirmDelete(false)}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
}
