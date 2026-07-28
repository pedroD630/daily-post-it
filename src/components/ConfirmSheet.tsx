/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generic confirmation bottom sheet — replaces jarring native window.confirm
 * dialogs with a styled, theme-aware sheet consistent with the rest of the UI.
 */

import { motion, AnimatePresence } from "motion/react";

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = red confirm button (destructive actions). */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSheet({
  open, title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger, onConfirm, onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[85] bg-black/45 backdrop-blur-sm"
            onClick={onCancel}
            aria-hidden
          />
          <motion.div
            key="confirm-sheet"
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[86] mx-auto max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-full shadow-2xl px-6 pt-4 pb-7 md:py-6"
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 md:hidden" />
            <h3 className="font-sans font-bold text-base text-slate-900 dark:text-slate-100">{title}</h3>
            {message && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{message}</p>}
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-400 outline-none"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                autoFocus
                className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm shadow cursor-pointer outline-none focus-visible:ring-2 ${
                  danger
                    ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-400"
                    : "bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white focus-visible:ring-slate-400"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
