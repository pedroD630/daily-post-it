/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Editable affirmation list: add, drag to reorder, delete.
 *
 * Reordering uses `Reorder` from motion/react — the same primitive the
 * post-it task list already uses — so no drag-and-drop dependency is added.
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import { X, Plus, GripVertical, Trash2 } from "lucide-react";
import { MAX_AFFIRMATIONS, SUGGESTED_AFFIRMATIONS } from "../db";
import ConfirmSheet from "./ConfirmSheet";

interface Props {
  open: boolean;
  items: string[];
  onClose: () => void;
  onSave: (items: string[]) => void;
}

/** Reorder.Item needs a stable identity; raw strings collide on duplicates. */
interface Row { id: string; text: string; }

export default function AffirmationEditor({ open, items, onClose, onSave }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(items.map((text) => ({ id: crypto.randomUUID(), text })));
    setDraft("");
    setError(null);
  }, [open, items]);

  // Suggestions already in the list are hidden so the section shrinks to
  // nothing once the user has built their own set.
  const unusedSuggestions = SUGGESTED_AFFIRMATIONS.filter(
    (s) => !rows.some((r) => r.text.trim() === s)
  );

  const add = () => {
    const text = draft.trim();
    if (text.length < 3) return setError("Escreva a afirmação.");
    if (rows.length >= MAX_AFFIRMATIONS) {
      return setError(`Máximo de ${MAX_AFFIRMATIONS} afirmações.`);
    }
    setRows((prev) => [...prev, { id: crypto.randomUUID(), text }]);
    setDraft("");
    setError(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="affeditor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[75] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="affeditor-panel"
            role="dialog"
            aria-modal
            aria-label="Editar afirmações"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[76] mx-auto max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 shadow-2xl pt-3 max-h-[92vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-3 md:hidden" />
            <div className="px-5 pb-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-sans font-bold text-lg text-slate-900 dark:text-slate-100">
                  Suas afirmações
                </h3>
                <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <p className="text-[11px] font-mono text-slate-400">
                Arraste pela alça para reordenar · {rows.length}/{MAX_AFFIRMATIONS}
              </p>

              <Reorder.Group axis="y" values={rows} onReorder={setRows} className="flex flex-col gap-2">
                {rows.map((row) => (
                  <Reorder.Item
                    key={row.id}
                    value={row}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-100 leading-snug">
                      {row.text}
                    </span>
                    <button
                      type="button"
                      aria-label={`Excluir afirmação: ${row.text}`}
                      onClick={() => setPendingDelete(row)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              {/* Add new */}
              <div className="flex items-start gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Nova afirmação…"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
                <button
                  type="button"
                  aria-label="Adicionar afirmação"
                  onClick={add}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              {/* Optional starting points — nothing is added until tapped. */}
              {unusedSuggestions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sugestões
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Ideias para começar. Toque para adicionar à sua lista e edite como quiser —
                    as afirmações que valem são as suas.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {unusedSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          if (rows.length >= MAX_AFFIRMATIONS) {
                            return setError(`Máximo de ${MAX_AFFIRMATIONS} afirmações.`);
                          }
                          // Guard inside the updater: two fast taps on the same
                          // suggestion both run against fresh `prev`, so without
                          // this the item lands in the list twice.
                          setRows((prev) =>
                            prev.some((r) => r.text.trim() === s) || prev.length >= MAX_AFFIRMATIONS
                              ? prev
                              : [...prev, { id: crypto.randomUUID(), text: s }]
                          );
                          setError(null);
                        }}
                        className="flex items-center gap-2 text-left text-xs text-slate-600 dark:text-slate-300 px-2.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-950/20 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="leading-snug">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => onSave(rows.map((r) => r.text))}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white shadow cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>
          </motion.div>

          <ConfirmSheet
            open={pendingDelete !== null}
            title="Excluir esta afirmação?"
            message={pendingDelete?.text ?? ""}
            confirmLabel="Excluir"
            danger
            onConfirm={() => {
              setRows((prev) => prev.filter((r) => r.id !== pendingDelete?.id));
              setPendingDelete(null);
            }}
            onCancel={() => setPendingDelete(null)}
          />
        </>
      )}
    </AnimatePresence>
  );
}
