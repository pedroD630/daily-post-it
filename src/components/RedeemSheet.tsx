/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bottom-sheet confirmation modal for redeeming a reward.
 * Slides up from the bottom on mobile; centers on desktop.
 */

import { motion, AnimatePresence } from "motion/react";
import { Reward } from "../constants/rewards";
import { formatBalance } from "../utils/points";

interface Props {
  reward: Reward | null; // null = sheet hidden
  balance: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RedeemSheet({ reward, balance, onConfirm, onCancel }: Props) {
  const isOpen = reward !== null;

  return (
    <AnimatePresence>
      {isOpen && reward && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
            aria-hidden="true"
          />
          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Confirm redeem ${reward.name}`}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-full shadow-2xl px-6 pt-5 pb-7 md:py-6"
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5 md:hidden" />
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0" aria-hidden="true">{reward.emoji}</span>
              <div className="flex-1">
                <h3 className="font-sans font-bold text-base text-slate-900 dark:text-slate-100">
                  Redeem &ldquo;{reward.name}&rdquo; for {formatBalance(reward.cost)} points?
                </h3>
                <p className="font-mono text-xs text-slate-500 mt-1.5">
                  Current balance: <span className="font-bold text-slate-700 dark:text-slate-300">{formatBalance(balance)}</span>
                  <span className="mx-1.5">→</span>
                  After: <span className="font-bold text-slate-700 dark:text-slate-300">{formatBalance(balance - reward.cost)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white shadow cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
