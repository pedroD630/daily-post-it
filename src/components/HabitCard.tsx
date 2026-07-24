/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Habit card — big streak counter, progress bar toward 90 days with 30/60/90
 * checkpoints, SOS + relapse buttons. Fires confetti when 90 is reached.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { HeartPulse, Trophy, Check, Circle } from "lucide-react";
import { Habit } from "../types";
import {
  calculateStreak, getCheckpoints, getProgressPercent, getStreakTier,
} from "../utils/streakCalculator";
import ConfettiBurst from "./ConfettiBurst";

interface Props {
  key?: React.Key;
  habit: Habit;
  onSOS: (habit: Habit) => void;
  onRelapse: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
}

const BAR_COLORS: Record<string, string> = {
  neutral: "linear-gradient(90deg, #94a3b8, #cbd5e1)",
  amber:   "linear-gradient(90deg, #f59e0b, #fbbf24)",
  green:   "linear-gradient(90deg, #16a34a, #4ade80)",
  gold:    "linear-gradient(90deg, #d4af37, #fde68a)",
};

export default function HabitCard({ habit, onSOS, onRelapse, onEdit }: Props) {
  const streak = calculateStreak(habit.lastRelapseDate);
  const checkpoints = getCheckpoints(streak);
  const pct = getProgressPercent(streak);
  const tier = getStreakTier(streak);

  // Fire confetti once when crossing into >= 90 (rising edge across mounts).
  const reached90 = streak >= 90;
  const [burst, setBurst] = useState(0);
  const prev90 = useRef<boolean | null>(null);
  useEffect(() => {
    // On first mount, seed prev without firing unless already 90 and not
    // previously celebrated this session for this habit.
    const key = `habit90_celebrated_${habit.id}`;
    if (prev90.current === null) {
      prev90.current = reached90;
      if (reached90 && typeof sessionStorage !== "undefined" && !sessionStorage.getItem(key)) {
        setBurst((b) => b + 1);
        try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
      }
      return;
    }
    if (reached90 && !prev90.current) {
      setBurst((b) => b + 1);
      try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    }
    prev90.current = reached90;
  }, [reached90, habit.id]);

  return (
    <div
      id={`habit-card-${habit.id}`}
      className="relative overflow-hidden bg-white/85 dark:bg-slate-900/85 backdrop-blur-lg border border-white/50 dark:border-slate-800/60 rounded-3xl p-5 shadow-sm"
    >
      <ConfettiBurst burst={burst} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={() => onEdit(habit)}
          className="flex items-center gap-2 min-w-0 cursor-pointer text-left"
        >
          <span className="text-2xl shrink-0" aria-hidden>{habit.icon || "🔒"}</span>
          <span className="font-sans font-bold text-base text-slate-800 dark:text-slate-100 truncate">{habit.name}</span>
        </button>
        <button
          type="button"
          aria-label="SOS — apoio motivacional"
          title="SOS"
          onClick={() => onSOS(habit)}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[11px] font-bold border border-rose-200 dark:border-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-900/50 cursor-pointer"
        >
          <HeartPulse className="w-3.5 h-3.5" /> SOS
        </button>
      </div>

      {/* Streak counter */}
      <div className="text-center py-3">
        <motion.div
          key={streak}
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className={`font-mono font-bold tabular-nums leading-none ${
            tier === "gold" ? "text-amber-500" : "text-slate-800 dark:text-slate-100"
          }`}
          style={{ fontSize: "3rem" }}
        >
          {streak}
        </motion.div>
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
          {streak === 1 ? "dia" : "dias"} sem recaída
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 relative w-full h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            backgroundImage: BAR_COLORS[tier],
            boxShadow: tier === "gold" ? "0 0 8px rgba(212,175,55,0.6)" : undefined,
          }}
        />
      </div>

      {/* Checkpoints 30 / 60 / 90 */}
      <div className="flex items-center justify-between mt-2.5 px-0.5">
        {checkpoints.map((cp) => {
          const is90 = cp.days === 90;
          return (
            <div key={cp.days} className="flex items-center gap-1">
              {cp.reached ? (
                is90 ? (
                  <Trophy className="w-4 h-4 text-amber-500" fill="currentColor" />
                ) : (
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    cp.days === 30 ? "bg-amber-500" : "bg-green-500"
                  }`}>
                    <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                  </span>
                )
              ) : (
                <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
              )}
              <span className={`font-mono text-[11px] ${cp.reached ? "font-bold text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
                {cp.days}
              </span>
            </div>
          );
        })}
      </div>

      {reached90 && (
        <p className="text-center text-[12px] text-amber-600 dark:text-amber-400 font-semibold mt-3">
          🏆 Parabéns! Você atingiu 90 dias. Continue assim.
        </p>
      )}

      {/* Relapse */}
      <button
        type="button"
        onClick={() => onRelapse(habit)}
        className="w-full mt-4 py-2 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-semibold border border-rose-200/70 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
      >
        Tive uma recaída
      </button>
    </div>
  );
}
