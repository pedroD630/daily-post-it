/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Belief Breaker screen. Evidence counts are derived from the day history in
 * one pass, so the whole list is a pure function of (beliefs, allDays).
 */

import React, { useMemo, useState } from "react";
import { Plus, Brain } from "lucide-react";
import { Belief, Day } from "../types";
import { countEvidenceForBeliefs } from "../utils/beliefProgress";
import BeliefCard from "./BeliefCard";
import BeliefFormSheet from "./BeliefFormSheet";

interface Props {
  beliefs: Belief[];
  allDays: Day[];
  onSaveBelief: (belief: Belief) => void;
  onDeleteBelief: (id: string) => void;
}

export default function BeliefsView({ beliefs, allDays, onSaveBelief, onDeleteBelief }: Props) {
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
