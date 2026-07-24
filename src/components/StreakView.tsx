/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Streak Tracker — list of quit-habits, each with a streak counter toward
 * 90 days. Owns the sheet/modal UI state; persistence is delegated to the
 * parent (App.tsx) so cloud sync stays centralized.
 */

import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Habit } from "../types";
import HabitCard from "./HabitCard";
import HabitFormSheet from "./HabitFormSheet";
import RelapseConfirmSheet from "./RelapseConfirmSheet";
import SOSModal from "./SOSModal";
import { todayISO } from "../utils/streakCalculator";

interface Props {
  habits: Habit[];
  onSaveHabit: (habit: Habit) => Promise<void> | void;
  onDeleteHabit: (id: string) => Promise<void> | void;
}

const MAX_HABITS = 10;

export default function StreakView({ habits, onSaveHabit, onDeleteHabit }: Props) {
  const active = habits.filter((h) => h.active && !h.deleted);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [relapseFor, setRelapseFor] = useState<Habit | null>(null);
  const [sosFor, setSosFor] = useState<Habit | null>(null);

  const canCreate = active.length < MAX_HABITS;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (h: Habit) => { setEditing(h); setFormOpen(true); };

  const confirmRelapse = () => {
    if (!relapseFor) return;
    onSaveHabit({ ...relapseFor, lastRelapseDate: todayISO(), updatedAt: Date.now() });
    setRelapseFor(null);
  };

  return (
    <div className="w-full max-w-md mx-auto py-6 px-4 select-none flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <ShieldCheck className="w-5 h-5 text-emerald-500" />
        <h2 className="font-sans font-bold text-lg text-slate-800 dark:text-slate-100">Streak</h2>
      </div>

      <button
        type="button"
        onClick={openCreate}
        disabled={!canCreate}
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed transition-colors ${
          canCreate
            ? "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 cursor-pointer"
            : "border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed"
        }`}
      >
        <Plus className="w-4 h-4" />
        <span className="font-semibold text-sm">{canCreate ? "Novo hábito" : `Até ${MAX_HABITS} hábitos`}</span>
      </button>

      {active.length === 0 && (
        <div className="text-center py-10 px-4 opacity-70">
          <ShieldCheck className="w-8 h-8 text-slate-400 mb-2 mx-auto" />
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Cadastre um hábito que você quer abandonar e acompanhe seus dias limpos rumo aos 90.
            No momento de fraqueza, toque em SOS.
          </p>
        </div>
      )}

      {active.map((h) => (
        <HabitCard
          key={h.id}
          habit={h}
          onSOS={setSosFor}
          onRelapse={setRelapseFor}
          onEdit={openEdit}
        />
      ))}

      <HabitFormSheet
        open={formOpen}
        initial={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={async (h) => { await onSaveHabit(h); setFormOpen(false); setEditing(null); }}
        onDelete={async (id) => { await onDeleteHabit(id); setFormOpen(false); setEditing(null); }}
      />

      <RelapseConfirmSheet
        habit={relapseFor}
        onConfirm={confirmRelapse}
        onCancel={() => setRelapseFor(null)}
      />

      <SOSModal
        open={sosFor !== null}
        habitName={sosFor?.name}
        onClose={() => setSosFor(null)}
      />
    </div>
  );
}
