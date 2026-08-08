/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-screen affirmations screen, shown on launch inside the morning and
 * evening windows. Every affirmation is on one page — the point is a slow,
 * deliberate read, not a carousel.
 *
 * "Li e afirmo" marks the session done for today; the ✕ only dismisses, so
 * the screen returns on the next launch inside the same window.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Pencil, Check } from "lucide-react";
import { AffirmationSession, SESSION_GREETING } from "../utils/affirmationScheduler";
import AffirmationEditor from "./AffirmationEditor";

interface Props {
  open: boolean;
  session: AffirmationSession;
  affirmations: string[];
  onConfirm: () => void;
  onDismiss: () => void;
  onSaveAffirmations: (items: string[]) => void;
}

export default function AffirmationModal({
  open, session, affirmations, onConfirm, onDismiss, onSaveAffirmations,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const greeting = SESSION_GREETING[session];

  const handleConfirm = () => {
    // Brief confirmation beat before the screen leaves.
    setConfirmed(true);
    window.setTimeout(() => {
      setConfirmed(false);
      onConfirm();
    }, 700);
  };

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          key="affirmation-modal"
          role="dialog"
          aria-modal
          aria-label="Afirmações do dia"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] overflow-y-auto bg-gradient-to-b from-amber-50 to-white dark:from-slate-950 dark:to-slate-900"
        >
          <div className="min-h-full w-full max-w-md mx-auto px-6 py-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-sans font-bold text-slate-900 dark:text-slate-100">
                  <span aria-hidden className="mr-1.5">{greeting.emoji}</span>
                  {greeting.text}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Suas afirmações de hoje
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Editar afirmações"
                  onClick={() => setEditing(true)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={onDismiss}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Affirmation cards */}
            <div className="flex flex-col gap-3 flex-1">
              {affirmations.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-10">
                  Você removeu todas as afirmações. Toque no lápis para escrever as suas.
                </p>
              ) : (
                affirmations.map((text, i) => (
                  <motion.div
                    key={`${i}-${text}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * i, duration: 0.3 }}
                    className="rounded-2xl bg-white/90 dark:bg-slate-800/70 border border-black/5 dark:border-white/10 shadow-sm px-5 py-4"
                  >
                    <p
                      className="text-slate-800 dark:text-slate-100"
                      style={{ fontSize: "1.1rem", lineHeight: 1.8 }}
                    >
                      "{text}"
                    </p>
                  </motion.div>
                ))
              )}
            </div>

            {/* Confirm */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirmed}
              className="sticky bottom-4 w-full py-3.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold shadow-lg hover:bg-slate-800 dark:hover:bg-white cursor-pointer flex items-center justify-center gap-2 disabled:opacity-100"
            >
              {confirmed ? (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <Check className="w-5 h-5" /> Afirmado
                </motion.span>
              ) : (
                "Li e afirmo"
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/*
      Kept outside the AnimatePresence above: the editor is a fixed overlay
      with its own AnimatePresence, and nesting one inside a subtree that is
      exiting is a known way to stall the parent's unmount. It renders null
      when closed, so sitting here costs nothing.
    */}
    <AffirmationEditor
      open={editing}
      items={affirmations}
      onClose={() => setEditing(false)}
      onSave={(items) => { onSaveAffirmations(items); setEditing(false); }}
    />
    </>
  );
}
