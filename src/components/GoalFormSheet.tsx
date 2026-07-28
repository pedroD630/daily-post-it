/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Create / edit a goal in a bottom sheet (full modal on mobile, centered
 * panel on desktop). Returns the new goal via `onSave`; the parent owns
 * persistence and cloud sync.
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Tag, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { Goal } from "../types";
import { GOAL_COLORS, DEFAULT_GOAL_COLOR } from "../constants/goalColors";
import { normalize } from "../utils/goalMatching";
import ConfirmSheet from "./ConfirmSheet";

interface GoalFormSheetProps {
  open: boolean;
  initial: Goal | null;             // null = create mode
  onClose: () => void;
  onSave: (goal: Goal) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string, archived: boolean) => void;
}

const MAX_KEYWORDS = 10;
const MIN_KEYWORD_LEN = 3;

export default function GoalFormSheet({
  open, initial, onClose, onSave, onDelete, onArchive
}: GoalFormSheetProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [targetAmount, setTargetAmount] = useState(3);
  const [targetUnit, setTargetUnit] = useState<"day" | "week" | "month">("week");
  const [baseColor, setBaseColor] = useState(DEFAULT_GOAL_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Seed form from `initial` whenever the sheet opens (so reopening with a
  // different goal doesn't show stale state from a previous edit).
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDeadline(initial.deadline);
      setKeywords(initial.keywords);
      setTargetAmount(initial.targetFrequency.amount);
      setTargetUnit(initial.targetFrequency.unit);
      setBaseColor(initial.baseColor);
    } else {
      setTitle("");
      // Default deadline: 6 months from today
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      setDeadline(toISODate(d));
      setKeywords([]);
      setTargetAmount(3);
      setTargetUnit("week");
      setBaseColor(DEFAULT_GOAL_COLOR);
    }
    setKeywordDraft("");
    setError(null);
  }, [open, initial]);

  const today = useMemo(() => toISODate(new Date()), []);

  const commitKeyword = () => {
    const cleaned = normalize(keywordDraft);
    if (!cleaned) return;
    if (cleaned.length < MIN_KEYWORD_LEN) {
      setError(`Each keyword needs ${MIN_KEYWORD_LEN}+ characters.`);
      return;
    }
    if (keywords.includes(cleaned)) {
      setKeywordDraft("");
      return;
    }
    if (keywords.length >= MAX_KEYWORDS) {
      setError(`Up to ${MAX_KEYWORDS} keywords per goal.`);
      return;
    }
    setKeywords([...keywords, cleaned]);
    setKeywordDraft("");
    setError(null);
  };

  const removeKeyword = (kw: string) => setKeywords(keywords.filter((k) => k !== kw));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    if (!deadline)     return setError("Deadline is required.");
    if (deadline < today) return setError("Deadline must be today or later.");
    if (keywords.length === 0) return setError("Add at least one keyword.");
    if (targetAmount < 1) return setError("Target frequency must be at least 1.");

    const next: Goal = {
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      deadline,
      keywords,
      targetFrequency: { amount: targetAmount, unit: targetUnit },
      baseColor,
      createdAt: initial?.createdAt ?? Date.now(),
      archived: initial?.archived ?? false,
      updatedAt: Date.now(),
    };
    onSave(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="goalform-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.form
            key="goalform-panel"
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal
            aria-label={initial ? "Edit goal" : "New goal"}
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
                  {initial ? "Edit goal" : "New goal"}
                </h3>
                <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Title */}
              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Title</span>
                <input
                  id="goal-form-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Graduate from college"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>

              {/* Deadline */}
              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Deadline</span>
                <input
                  id="goal-form-deadline"
                  type="date"
                  value={deadline}
                  min={today}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>

              {/* Keywords */}
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
                  Keywords <span className="opacity-50">({keywords.length}/{MAX_KEYWORDS})</span>
                </span>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {keywords.map((kw) => (
                    <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs">
                      <Tag className="w-3 h-3" />
                      {kw}
                      <button type="button" aria-label={`Remove ${kw}`} onClick={() => removeKeyword(kw)} className="ml-0.5 opacity-60 hover:opacity-100">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="goal-form-keyword-input"
                    type="text"
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        commitKeyword();
                      }
                    }}
                    placeholder="add keyword, press enter"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button type="button" onClick={commitKeyword} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                    Add
                  </button>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Case-insensitive substring match (e.g. "estudar" matches "vou estudar bastante").
                </span>
              </div>

              {/* Target frequency */}
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Target frequency</span>
                <div className="flex items-center gap-2">
                  <input
                    id="goal-form-target-amount"
                    type="number"
                    min={1}
                    max={999}
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(parseInt(e.target.value || "1", 10))}
                    className="w-20 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-sm text-slate-500">times per</span>
                  <select
                    id="goal-form-target-unit"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value as "day" | "week" | "month")}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="day">day</option>
                    <option value="week">week</option>
                    <option value="month">month</option>
                  </select>
                </div>
              </div>

              {/* Base color */}
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Card color</span>
                <div className="flex items-center gap-2">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={`Pick ${c.name}`}
                      onClick={() => setBaseColor(c.hex)}
                      className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer ${
                        baseColor === c.hex ? "border-slate-800 dark:border-white scale-110 shadow" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 font-medium">{error}</p>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white shadow cursor-pointer"
                  >
                    {initial ? "Save" : "Create"}
                  </button>
                </div>
                {initial && (
                  <div className="flex items-center gap-2 mt-1">
                    {onArchive && (
                      <button
                        type="button"
                        onClick={() => onArchive(initial.id, !initial.archived)}
                        className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {initial.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        {initial.archived ? "Unarchive" : "Archive"}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex-1 py-2 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.form>

          {initial && onDelete && (
            <ConfirmSheet
              open={confirmDelete}
              title={`Excluir "${initial.title}"?`}
              message="A meta é removida permanentemente. As tarefas passadas continuam nos seus registros."
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

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
