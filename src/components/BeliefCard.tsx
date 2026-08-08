/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One belief, rendered as a tug-of-war between the negative statement (which
 * fades and gets struck through as evidence piles up) and the healthy one
 * (which sharpens into focus). Purely a function of the evidence count.
 */

import React from "react";
import { motion } from "motion/react";
import { Check, Pencil } from "lucide-react";
import { Belief } from "../types";
import {
  EVIDENCE_GOAL,
  STAGE_LABEL,
  getBeliefStage,
  getProgressPercent,
} from "../utils/beliefProgress";

interface Props {
  key?: React.Key;
  belief: Belief;
  evidenceCount: number;
  onEdit: (belief: Belief) => void;
}

/** Opacity + decoration per stage, for each half of the card. */
const NEGATIVE_STYLE = {
  rooted:      { opacity: 1,    lineThrough: false },
  questioning: { opacity: 0.6,  lineThrough: false },
  weakening:   { opacity: 0.3,  lineThrough: true },
  broken:      { opacity: 0.15, lineThrough: true },
} as const;

const HEALTHY_STYLE = {
  rooted:      { opacity: 0.3, italic: true,  bold: false },
  questioning: { opacity: 0.6, italic: true,  bold: false },
  weakening:   { opacity: 0.9, italic: false, bold: false },
  broken:      { opacity: 1,   italic: false, bold: true },
} as const;

export default function BeliefCard({ belief, evidenceCount, onEdit }: Props) {
  const stage = getBeliefStage(evidenceCount);
  const percent = getProgressPercent(evidenceCount);
  const neg = NEGATIVE_STYLE[stage];
  const pos = HEALTHY_STYLE[stage];
  const broken = stage === "broken";

  return (
    <section
      id={`belief-card-${belief.id}`}
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm flex flex-col gap-3"
    >
      {/* Progress + count */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 24 }}
            className={`h-full rounded-full ${broken ? "bg-emerald-500" : "bg-amber-400"}`}
          />
        </div>
        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
          {broken && <Check className="w-3.5 h-3.5 text-emerald-500" />}
          {evidenceCount} {evidenceCount === 1 ? "evidência" : "evidências"}
        </span>
        <button
          type="button"
          aria-label="Editar crença"
          onClick={() => onEdit(belief)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
        {STAGE_LABEL[stage]}
        {!broken && ` · faltam ${EVIDENCE_GOAL - evidenceCount}`}
      </p>

      {/* Negative belief — fades out */}
      <motion.p
        animate={{ opacity: neg.opacity }}
        transition={{ duration: 0.4 }}
        className={`text-sm leading-snug text-slate-900 dark:text-slate-100 ${
          neg.lineThrough ? "line-through decoration-2" : ""
        }`}
      >
        "{belief.negativeStatement}"
      </motion.p>

      {/* Healthy belief — sharpens into focus */}
      <motion.p
        animate={{ opacity: pos.opacity }}
        transition={{ duration: 0.4 }}
        className={`text-sm leading-snug ${pos.italic ? "italic" : ""} ${
          pos.bold ? "font-bold" : ""
        } ${broken ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}
      >
        "{belief.healthyStatement}"
      </motion.p>

      {/* Keywords */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span aria-hidden className="text-[11px]">🔑</span>
        {belief.keywords.map((kw) => (
          <span
            key={kw}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          >
            {kw}
          </span>
        ))}
      </div>
    </section>
  );
}
