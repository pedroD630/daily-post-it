/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Create / edit a belief in a bottom sheet. Mirrors HabitFormSheet.
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Trash2, Archive } from "lucide-react";
import { Belief } from "../types";
import { normalize } from "../utils/beliefMatching";
import ConfirmSheet from "./ConfirmSheet";

interface Props {
  open: boolean;
  initial: Belief | null; // null = create
  onClose: () => void;
  onSave: (belief: Belief) => void;
  onDelete?: (id: string) => void;
  onArchive?: (belief: Belief) => void;
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400";

export default function BeliefFormSheet({ open, initial, onClose, onSave, onDelete, onArchive }: Props) {
  const [negative, setNegative] = useState("");
  const [healthy, setHealthy] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwDraft, setKwDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNegative(initial?.negativeStatement ?? "");
    setHealthy(initial?.healthyStatement ?? "");
    setKeywords(initial?.keywords ?? []);
    setKwDraft("");
    setError(null);
  }, [open, initial]);

  const addKeyword = () => {
    const kw = normalize(kwDraft);
    if (kw.length < 3) {
      setError("Cada palavra-chave precisa de pelo menos 3 letras.");
      return;
    }
    if (keywords.includes(kw)) {
      setKwDraft("");
      return;
    }
    setKeywords((prev) => [...prev, kw]);
    setKwDraft("");
    setError(null);
  };

  const onKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter or comma commits the tag instead of submitting the form.
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    } else if (e.key === "Backspace" && kwDraft === "" && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const neg = negative.trim();
    const pos = healthy.trim();
    if (neg.length < 3) return setError("Escreva a crença negativa.");
    if (pos.length < 3) return setError("Escreva a crença saudável que a substitui.");
    if (keywords.length === 0) return setError("Adicione pelo menos uma palavra-chave.");

    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      negativeStatement: neg,
      healthyStatement: pos,
      keywords,
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
            key="beliefform-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.form
            key="beliefform-panel"
            onSubmit={submit}
            role="dialog"
            aria-modal
            aria-label={initial ? "Editar crença" : "Nova crença"}
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
                  {initial ? "Editar crença" : "Nova crença"}
                </h3>
                <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Crença negativa</span>
                <textarea
                  id="belief-form-negative"
                  value={negative}
                  onChange={(e) => setNegative(e.target.value)}
                  rows={2}
                  placeholder="Ex: Eu nunca termino o que começo."
                  className={`${inputClass} resize-none`}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Crença saudável</span>
                <textarea
                  id="belief-form-healthy"
                  value={healthy}
                  onChange={(e) => setHealthy(e.target.value)}
                  rows={2}
                  placeholder="Ex: Eu concluo o que me proponho, um passo por vez."
                  className={`${inputClass} resize-none`}
                />
              </label>

              {/* Keyword tag input */}
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Palavras-chave</span>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((kw) => (
                      <span key={kw} className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                        {kw}
                        <button
                          type="button"
                          aria-label={`Remover ${kw}`}
                          onClick={() => setKeywords((prev) => prev.filter((k) => k !== kw))}
                          className="hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    id="belief-form-keyword"
                    type="text"
                    value={kwDraft}
                    onChange={(e) => setKwDraft(e.target.value)}
                    onKeyDown={onKeywordKeyDown}
                    placeholder="treino, estudei, resisti…"
                    className={inputClass}
                  />
                  <button type="button" onClick={addKeyword} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shrink-0">
                    Add
                  </button>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Toda tarefa concluída que contenha uma destas palavras vira uma evidência.
                </span>
              </div>

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
                {initial && onArchive && (
                  <button
                    type="button"
                    onClick={() => onArchive(initial)}
                    className="py-2 rounded-xl text-slate-500 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {initial.active ? "Arquivar crença" : "Reativar crença"}
                  </button>
                )}
                {initial && onDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="py-2 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir crença
                  </button>
                )}
              </div>
            </div>
          </motion.form>

          {initial && onDelete && (
            <ConfirmSheet
              open={confirmDelete}
              title="Excluir esta crença?"
              message="Ela sai da lista em todos os seus dispositivos. Para apenas escondê-la, use Arquivar."
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
