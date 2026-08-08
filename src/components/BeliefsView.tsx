/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Belief Breaker screen. Evidence counts are derived from the day history in
 * one pass, so the whole list is a pure function of (beliefs, allDays).
 */

import React, { useMemo, useState } from "react";
import { Plus, Brain, Sunrise } from "lucide-react";
import { Belief, Day } from "../types";
import { countEvidenceForBeliefs } from "../utils/beliefProgress";
import BeliefCard from "./BeliefCard";
import BeliefFormSheet from "./BeliefFormSheet";

interface Props {
  beliefs: Belief[];
  allDays: Day[];
  onSaveBelief: (belief: Belief) => void;
  onDeleteBelief: (id: string) => void;
  /** Opens the affirmations editor. Lives here rather than in Settings:
   *  affirmations and beliefs are the same practice, and the morning/evening
   *  modal only exists inside its time windows. */
  onOpenAffirmations?: () => void;
  affirmationCount?: number;
}

export default function BeliefsView({ beliefs, allDays, onSaveBelief, onDeleteBelief, onOpenAffirmations, affirmationCount = 0 }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Belief | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const evidence = useMemo(
    () => countEvidenceForBeliefs(beliefs, allDays),
    [beliefs, allDays]
  );

  const visible = beliefs
    .filter((b) => (showArchived ? !b.active : b.active))
    .sort((a, b) => a.createdAt - b.createdAt);

  const archivedCount = beliefs.filter((b) => !b.active).length;

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (b: Belief) => { setEditing(b); setSheetOpen(true); };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-24">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-sans font-bold text-lg text-slate-900 dark:text-slate-100">
          <Brain className="w-5 h-5 text-indigo-500" />
          Suas crenças
        </h2>
        <button
          id="beliefs-add-btn"
          type="button"
          aria-label="Nova crença"
          onClick={openCreate}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Cada tarefa concluída que contenha uma palavra-chave vira uma evidência
        contra a crença negativa. Com 30 evidências, ela se quebra.
      </p>

      {/* Daily affirmations — reachable at any hour, unlike the modal */}
      {onOpenAffirmations && (
        <button
          type="button"
          id="beliefs-affirmations-entry"
          onClick={onOpenAffirmations}
          className="flex items-center gap-3 text-left bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm hover:border-amber-300 dark:hover:border-amber-800 cursor-pointer"
        >
          <Sunrise className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
              {affirmationCount === 0 ? "Escrever minhas afirmações" : "Minhas afirmações"}
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
              Aparecem ao abrir o app de manhã (06h–12h) e à noite (18h–24h). São só suas.
            </span>
          </span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
            {affirmationCount === 0 ? "nenhuma" : affirmationCount}
          </span>
        </button>
      )}

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="self-start text-[11px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer underline underline-offset-2"
        >
          {showArchived ? "← Ver crenças ativas" : `Ver arquivadas (${archivedCount})`}
        </button>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4 opacity-70">
          <Brain className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-sm text-slate-500">
            {showArchived
              ? "Nenhuma crença arquivada."
              : "Nenhuma crença ativa. Toque em + para adicionar a primeira."}
          </p>
        </div>
      ) : (
        visible.map((b) => (
          <BeliefCard
            key={b.id}
            belief={b}
            evidenceCount={evidence.get(b.id) ?? 0}
            onEdit={openEdit}
          />
        ))
      )}

      <BeliefFormSheet
        open={sheetOpen}
        initial={editing}
        onClose={() => setSheetOpen(false)}
        onSave={(b) => { onSaveBelief(b); setSheetOpen(false); }}
        onDelete={(id) => { onDeleteBelief(id); setSheetOpen(false); }}
        onArchive={(b) => {
          onSaveBelief({ ...b, active: !b.active, updatedAt: Date.now() });
          setSheetOpen(false);
        }}
      />
    </div>
  );
}
