/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Relapse confirmation bottom sheet. No punitive animation — a calm confirm.
 */

import { motion, AnimatePresence } from "motion/react";
import { Habit } from "../types";
import { calculateStreak } from "../utils/streakCalculator";

interface Props {
  habit: Habit | null; // null = hidden
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RelapseConfirmSheet({ habit, onConfirm, onCancel }: Props) {
  const open = habit !== null;
  const streak = habit ? calculateStreak(habit.lastRelapseDate) : 0;

  return (
    <AnimatePresence>
      {open && habit && (
        <>
          <motion.div
            key="relapse-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm"
            onClick={onCancel}
            aria-hidden
          />
          <motion.div
            key="relapse-sheet"
            role="dialog"
            aria-modal
            aria-label={`Registrar recaída em ${habit.name}`}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[71] mx-auto max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-full shadow-2xl px-6 pt-4 pb-7 md:py-6"
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 md:hidden" />
            <h3 className="font-sans font-bold text-base text-slate-900 dark:text-slate-100">
              Registrar recaída em &ldquo;{habit.name}&rdquo;?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Seu streak atual é de <span className="font-bold text-slate-700 dark:text-slate-200">{streak} {streak === 1 ? "dia" : "dias"}</span>.
              Isso vai zerar o contador. Recomeçar faz parte — o importante é continuar.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow cursor-pointer"
              >
                Sim, registrar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
