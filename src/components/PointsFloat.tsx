/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tiny floating "+10" / "-10" label that drifts upward and fades out
 * when a task is toggled. Triggered by passing a non-null `points` value;
 * the component auto-clears itself after the animation duration.
 */

import { motion, AnimatePresence } from "motion/react";

interface Props {
  /** Signed points value to display (e.g. +10, -7). Null = nothing rendered. */
  points: number | null;
  /** Stroke/text color (typically the task's pen color, or red for negatives). */
  color: string;
  /** Stable key — change it to retrigger the animation on the same value. */
  triggerKey: number | string;
}

export default function PointsFloat({ points, color, triggerKey }: Props) {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none select-none"
      style={{ zIndex: 20 }}
    >
      <AnimatePresence>
        {points !== null && (
          <motion.span
            key={triggerKey}
            initial={{ opacity: 0, y: 0, scale: 0.85 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: -32, scale: 0.85 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-mono font-bold text-xs whitespace-nowrap"
            style={{ color, textShadow: "0 1px 2px rgba(255,255,255,0.6)" }}
          >
            {points > 0 ? `+${points}` : `${points}`}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
