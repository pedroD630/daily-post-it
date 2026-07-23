/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goals view — tab toggle between the active list and the Insights panel.
 * Owns the form-sheet state but delegates persistence to the parent via
 * onSave / onDelete / onArchive callbacks (so cloud sync stays in App.tsx).
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Target as TargetIcon, BarChart3, ArchiveRestore } from "lucide-react";
import { Day, Goal } from "../types";
import GoalCard from "./GoalCard";
import GoalFormSheet from "./GoalFormSheet";
import GoalsInsightsPanel from "./GoalsInsightsPanel";

interface GoalsViewProps {
  goals: Goal[];
  allDays: Day[];
  pointsBalance: number;
  geminiApiKey?: string;
  onSaveGoal: (goal: Goal) => Promise<void> | void;
  onDeleteGoal: (id: string) => Promise<void> | void;
  onArchiveGoal: (id: string, archived: boolean) => Promise<void> | void;
}

type Tab = "list" | "insights";

const MAX_ACTIVE_GOALS = 12;

export default function GoalsView({
  goals, allDays, pointsBalance, geminiApiKey, onSaveGoal, onDeleteGoal, onArchiveGoal,
}: GoalsViewProps) {
  const [tab, setTab] = useState<Tab>("list");
  const [editing, setEditing] = useState<Goal | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl shadow-inner">
        <button
          id="goals-tab-list"
          type="button"
          onClick={() => setTab("list")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            tab === "list"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <TargetIcon className="w-4 h-4" />
          Goals
        </button>
        <button
          id="goals-tab-insights"
          type="button"
          onClick={() => setTab("insights")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            tab === "insights"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Insights
        </button>
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
              <GoalCard key={g.id} goal={g} allDays={allDays} onClick={() => openEdit(g)} />
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
        ) : (
          <motion.div
            key="goals-insights"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <GoalsInsightsPanel goals={goals} allDays={allDays} pointsBalance={pointsBalance} geminiApiKey={geminiApiKey} />
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
