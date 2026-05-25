/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reward Shop: balance card at top, grid of redeemable rewards beneath.
 * State for the confirmation sheet and the celebration animation lives here.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sunset,
  UtensilsCrossed,
  ShoppingBag,
  Shirt,
  Gamepad2,
  Smartphone,
  Popcorn,
  Moon,
  Pizza,
  Dumbbell,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { REWARDS, Reward } from "../constants/rewards";
import { formatBalance } from "../utils/points";
import RedeemSheet from "./RedeemSheet";

// Lookup map so we can render lucide icons by name (from the constant)
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sunset, UtensilsCrossed, ShoppingBag, Shirt, Gamepad2,
  Smartphone, Popcorn, Moon, Pizza, Dumbbell,
};

interface ShopViewProps {
  balance: number;
  onRedeem: (reward: Reward) => Promise<void> | void;
}

export default function ShopView({ balance, onRedeem }: ShopViewProps) {
  const [pendingReward, setPendingReward] = useState<Reward | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const isNegative = balance < 0;

  const handleConfirm = async () => {
    if (!pendingReward) return;
    const reward = pendingReward;
    setPendingReward(null);
    await onRedeem(reward);
    // Pulse the balance card by remounting the celebration overlay
    setCelebrationKey((k) => k + 1);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 select-none">
      {/* Balance card */}
      <div
        id="shop-balance-card"
        className="relative overflow-hidden bg-gradient-to-br from-amber-300 via-amber-200 to-yellow-100 dark:from-amber-700 dark:via-amber-800 dark:to-yellow-900 rounded-3xl p-5 mb-6 shadow-lg border border-amber-300/40"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-700 dark:text-amber-200" />
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-amber-900/80 dark:text-amber-100/80">
              Your balance
            </span>
          </div>
          <span
            id="shop-balance-value"
            className={`font-mono text-2xl font-bold tabular-nums ${
              isNegative ? "text-red-600" : "text-amber-900 dark:text-amber-50"
            }`}
          >
            {formatBalance(balance)} <span className="text-sm font-semibold">pts</span>
          </span>
        </div>

        {isNegative && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-700/90 font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            Balance is negative. Complete tasks to earn back.
          </p>
        )}

        {/* Celebration burst overlay (remounts on each redemption) */}
        <AnimatePresence>
          <motion.div
            key={celebrationKey}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 1, 0], scale: [0.85, 1.05, 1.0] }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none flex items-center justify-center text-3xl"
            aria-hidden="true"
          >
            {celebrationKey > 0 ? "✨🎉✨" : ""}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rewards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3" id="shop-rewards-grid">
        {REWARDS.map((reward) => {
          const Icon = ICONS[reward.icon];
          const affordable = balance >= reward.cost && !isNegative;

          return (
            <div
              key={reward.id}
              id={`reward-card-${reward.id}`}
              className={`flex flex-col items-center text-center gap-2 p-4 rounded-2xl border bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm shadow-sm transition-all ${
                affordable ? "border-slate-200 dark:border-slate-700 hover:shadow-md" : "border-slate-100 dark:border-slate-800 opacity-50"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-300">
                {Icon ? <Icon className="w-6 h-6" /> : <span className="text-xl">{reward.emoji}</span>}
              </div>

              <span className="font-sans text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                {reward.name}
              </span>

              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {formatBalance(reward.cost)} pts
              </span>

              <button
                type="button"
                disabled={!affordable}
                onClick={() => setPendingReward(reward)}
                className={`mt-1 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  affordable
                    ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                }`}
              >
                Redeem
              </button>
            </div>
          );
        })}
      </div>

      <RedeemSheet
        reward={pendingReward}
        balance={balance}
        onConfirm={handleConfirm}
        onCancel={() => setPendingReward(null)}
      />
    </div>
  );
}
