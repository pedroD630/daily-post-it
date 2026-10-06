/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Long-press fallback for moving a card. Dragging demands precision that a
 * thumb on a phone doesn't always have, so the same move is reachable from
 * a plain list of the other three columns.
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Circle, CircleDotDashed, CheckCircle2, XCircle, X } from "lucide-react";
import { Task, TaskStatus } from "../../types";
import { STATUS_META, TASK_STATUSES } from "../../constants/taskStatus";

const ICONS = { Circle, CircleDotDashed, CheckCircle2, XCircle } as const;

interface Props {
  task: Task | null;
  onClose: () => void;
  onPick: (status: TaskStatus) => void;
}

export default function StatusMenuSheet({ task, onClose, onPick }: Props) {
  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            key="statusmenu-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="statusmenu-panel"
            role="dialog"
            aria-modal
            aria-label="Mover tarefa"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[61] mx-auto max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 shadow-2xl pt-3"
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-3 md:hidden" />
            <div className="px-5 pb-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-sans font-bold text-base text-slate-900 dark:text-slate-100">Mover para</h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{task.text.trim() || "(sem título)"}</p>
                </div>
                <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                {TASK_STATUSES.filter((s) => s !== task.status).map((s) => {
                  const meta = STATUS_META[s];
                  const Icon = ICONS[meta.icon];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onPick(s)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-left"
                    >
                      <Icon className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
