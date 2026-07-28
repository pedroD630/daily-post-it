/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goals view — tab toggle between the active list and the Insights panel.
 * Owns the form-sheet state but delegates persistence to the parent via
 * onSave / onDelete / onArchive callbacks (so cloud sync stays in App.tsx).
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Target as TargetIcon, BarChart3, ArchiveRestore, Flag, ShieldCheck } from "lucide-react";
import { Checkpoint, Day, Goal, Habit } from "../types";
import GoalCard from "./GoalCard";
import GoalFormSheet from "./GoalFormSheet";
import GoalsInsightsPanel from "./GoalsInsightsPanel";
import CheckpointsPanel from "./CheckpointsPanel";
import StreakView from "./StreakView";
import ProductivityDashboard from "./ProductivityDashboard";
import { ParsedCheckpoint } from "../utils/checkpointParser";

export type ProgressTab = "list" | "insights" | "checkpoints" | "streak";

interface GoalsViewProps {
  goals: Goal[];
  allDays: Day[];
  pointsBalance: number;
  geminiApiKey?: string;
  checkpoints: Checkpoint[];
  habits: Habit[];
  initialTab?: ProgressTab;
  onSaveGoal: (goal: Goal) => Promise<void> | void;
  onDeleteGoal: (id: string) => Promise<void> | void;
  onArchiveGoal: (id: string, archived: boolean) => Promise<void> | void;
  onAddCheckpoint: (cp: ParsedCheckpoint) => Promise<void> | void;
  onToggleCheckpoint: (cp: Checkpoint) => Promise<void> | void;
  onDeleteCheckpoint: (id: string) => Promise<void> | void;
  onSaveHabit: (habit: Habit) => Promise<void> | void;
  onDeleteHabit: (id: string) => Promise<void> | void;
}

type Tab = ProgressTab;

const MAX_ACTIVE_GOALS = 12;

export default function GoalsView({
  goals, allDays, pointsBalance, geminiApiKey, checkpoints, habits, initialTab,
  onSaveGoal, onDeleteGoal, onArchiveGoal,
  onAddCheckpoint, onToggleCheckpoint, onDeleteCheckpoint,
  onSaveHabit, onDeleteHabit,
}: GoalsViewProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "list");
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // Seed passed to the AI chat when the user asks for the next step after
  // achieving a checkpoint. Consumed once by AIChatPanel.
  const [chatSeed, setChatSeed] = useState<string | undefined>(undefined);

  const askNextStep = (cp: Checkpoint, goal: Goal) => {
    setChatSeed(
      `Concluí o checkpoint "${cp.title}" da meta "${goal.title}". Qual deveria ser o próximo passo? Se fizer sentido, proponha o próximo checkpoint (mais ambicioso).`
    );
    setTab("insights");
  };

  const askSteps = (goal: Goal) => {
    setChatSeed(
      `Quais deveriam ser as etapas (checkpoints) para eu atingir a meta "${goal.title}"? Proponha marcos concretos e mensuráveis.`
    );
    setTab("insights");
  };

  const active = useMemo(() => goals.filter((g) => !g.archived), [goals]);
  const archived = useMemo(() => goals.filter((g) => g.archived), [goals]);
  const canCreateMore = active.length < MAX_ACTIVE_GOALS;

  const openCreate = () => {
    if (!canCreateMore) return;
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setSheetOpen(true);
  };
  const closeSheet = () => {
    setSheetOpen(false);
    setEditing(null);
  };

  return (
    <div className="w-full max-w-md mx-auto py-6 px-4 select-none flex flex-col gap-4">
      {/* Tabs — the Progress hub segments */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl shadow-inner overflow-x-auto">
        {([
          { id: "list", label: "Metas", icon: <TargetIcon className="w-4 h-4" /> },
          { id: "insights", label: "Insights", icon: <BarChart3 className="w-4 h-4" /> },
          { id: "checkpoints", label: "Checkpoints", icon: <Flag className="w-4 h-4" /> },
          { id: "streak", label: "Streak", icon: <ShieldCheck className="w-4 h-4" /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button
            key={t.id}
            id={`goals-tab-${t.id}`}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              tab === t.id
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "list" ? (
          <motion.div
            key="goals-list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-3"
          >
            {/* New goal button */}
            <button
              id="goals-new-btn"
              type="button"
              onClick={openCreate}
              disabled={!canCreateMore}
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed transition-colors ${
                canCreateMore
                  ? "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400 hover:text-amber-600 cursor-pointer"
                  : "border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="font-semibold text-sm">
                {canCreateMore ? "New goal" : `Up to ${MAX_ACTIVE_GOALS} active goals`}
              </span>
            </button>

            {/* Active list */}
            {active.length === 0 && !canCreateMore === false && (
              <div className="text-center py-8 px-4 opacity-70">
                <TargetIcon className="w-8 h-8 text-slate-400 mb-2 mx-auto" />
                <p className="text-sm text-slate-500">No goals yet. Tap "New goal" to start tracking your long-term targets.</p>
              </div>
            )}
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} allDays={allDays} onClick={() => openEdit(g)} onAskSteps={askSteps} />
            ))}

            {/* Archived section (collapsible) */}
            {archived.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowArchived((s) => !s)}
                  className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  {showArchived ? "Hide" : "Show"} archived ({archived.length})
                </button>
                {showArchived && (
                  <div className="flex flex-col gap-3 mt-2">
                    {archived.map((g) => (
                      <GoalCard key={g.id} goal={g} allDays={allDays} onClick={() => openEdit(g)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : tab === "insights" ? (
          <motion.div
            key="goals-insights"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            {/* Unified insights: the productivity dashboard (streak hero,
                weekly chart, stats) followed by the AI coach + goal analysis.
                Replaces the old separate standalone Insights view. */}
            <ProductivityDashboard allDays={allDays} pointsBalance={pointsBalance} />
            <GoalsInsightsPanel
              goals={goals}
              allDays={allDays}
              pointsBalance={pointsBalance}
              geminiApiKey={geminiApiKey}
              onAddCheckpoint={onAddCheckpoint}
              seedMessage={chatSeed}
              onSeedConsumed={() => setChatSeed(undefined)}
            />
          </motion.div>
        ) : tab === "checkpoints" ? (
          <motion.div
            key="goals-checkpoints"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <CheckpointsPanel
              checkpoints={checkpoints}
              goals={goals}
              onToggleAchieve={onToggleCheckpoint}
              onDelete={onDeleteCheckpoint}
              onAskNextStep={askNextStep}
            />
          </motion.div>
        ) : (
          <motion.div
            key="goals-streak"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <StreakView habits={habits} onSaveHabit={onSaveHabit} onDeleteHabit={onDeleteHabit} />
          </motion.div>
        )}
      </AnimatePresence>

      <GoalFormSheet
        open={sheetOpen}
        initial={editing}
        onClose={closeSheet}
        onSave={async (g) => {
          await onSaveGoal(g);
          closeSheet();
        }}
        onDelete={async (id) => {
          await onDeleteGoal(id);
          closeSheet();
        }}
        onArchive={async (id, archived) => {
          await onArchiveGoal(id, archived);
          closeSheet();
        }}
      />
    </div>
  );
}
