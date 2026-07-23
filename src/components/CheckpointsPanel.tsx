/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Checkpoints tab — milestones toward each goal, mostly AI-proposed.
 * Grouped by goal. Each can be marked achieved; achieving one offers to ask
 * the AI coach for the next step (evolution).
 */

import { useMemo } from "react";
import { motion } from "motion/react";
import { Flag, Check, Trash2, Sparkles, Target as TargetIcon } from "lucide-react";
import { Checkpoint, Goal } from "../types";

interface Props {
  checkpoints: Checkpoint[];
  goals: Goal[];
  onToggleAchieve: (cp: Checkpoint) => void;
  onDelete: (id: string) => void;
  onAskNextStep: (cp: Checkpoint, goal: Goal) => void;
}

export default function CheckpointsPanel({ checkpoints, goals, onToggleAchieve, onDelete, onAskNextStep }: Props) {
  const goalById = useMemo(() => {
    const m = new Map<string, Goal>();
    for (const g of goals) m.set(g.id, g);
    return m;
  }, [goals]);

  // Group checkpoints by goal, preserving order; drop orphans (goal deleted).
  const grouped = useMemo(() => {
    const groups = new Map<string, Checkpoint[]>();
    for (const cp of checkpoints) {
      if (!goalById.has(cp.goalId)) continue;
      const arr = groups.get(cp.goalId) ?? [];
      arr.push(cp);
      groups.set(cp.goalId, arr);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        if (a.achieved !== b.achieved) return a.achieved ? 1 : -1; // pending first
        return a.order - b.order || a.createdAt - b.createdAt;
      });
    }
    return groups;
  }, [checkpoints, goalById]);

  if (checkpoints.length === 0 || grouped.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 px-4 opacity-70">
        <Flag className="w-8 h-8 text-slate-400 mb-2" />
        <p className="text-sm text-slate-500 max-w-xs">
          Nenhum checkpoint ainda. Converse com o Coach IA na aba Insights e peça as etapas para
          atingir uma meta — as sugestões dele viram checkpoints aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {[...grouped.entries()].map(([goalId, items]) => {
        const goal = goalById.get(goalId)!;
        const doneCount = items.filter((c) => c.achieved).length;
        return (
          <section
            key={goalId}
            id={`checkpoints-goal-${goalId}`}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="flex items-center gap-1.5 font-sans font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                <TargetIcon className="w-4 h-4 text-slate-400 shrink-0" />
                {goal.title}
              </h3>
              <span className="font-mono text-[11px] text-slate-400 shrink-0">{doneCount}/{items.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {items.map((cp) => (
                <motion.div
                  key={cp.id}
                  layout
                  className={`flex items-start gap-2.5 rounded-xl p-2.5 border ${
                    cp.achieved
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30"
                      : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/50"
                  }`}
                >
                  {/* Achieve toggle */}
                  <button
                    type="button"
                    aria-label={cp.achieved ? "Marcar como não alcançado" : "Marcar como alcançado"}
                    onClick={() => onToggleAchieve(cp)}
                    className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                      cp.achieved
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-slate-300 dark:border-slate-600 hover:border-emerald-400"
                    }`}
                  >
                    {cp.achieved && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-semibold leading-snug ${
                      cp.achieved ? "text-slate-500 line-through" : "text-slate-800 dark:text-slate-100"
                    }`}>
                      {cp.title}
                    </p>
                    {cp.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{cp.description}</p>
                    )}
                    {cp.source === "ai" && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-indigo-500/70 mt-1">
                        <Sparkles className="w-2.5 h-2.5" /> sugerido pela IA
                      </span>
                    )}

                    {/* When achieved, offer to ask the AI for the next step */}
                    {cp.achieved && (
                      <button
                        type="button"
                        onClick={() => onAskNextStep(cp, goal)}
                        className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        Pedir próximo passo à IA
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label="Excluir checkpoint"
                    onClick={() => onDelete(cp.id)}
                    className="shrink-0 text-slate-300 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
