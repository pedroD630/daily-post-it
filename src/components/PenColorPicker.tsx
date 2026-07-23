/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quick pen-color selector for the main task screen. A brush button that
 * expands into the three ink presets (black / blue / red). Sits just above
 * the "add task" FAB so the user picks the color for the NEXT task inline,
 * without opening Settings.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Brush } from "lucide-react";
import { PEN_PRESETS } from "../constants/colors";

interface PenColorPickerProps {
  value: string;                       // current pen color hex
  onChange: (hex: string) => void;     // persists via applyQuickSettings
}

export default function PenColorPicker({ value, onChange }: PenColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-center gap-2">
      {/* Expanded ink swatches */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="flex flex-col items-center gap-2 mb-1"
            id="pen-color-swatches"
          >
            {PEN_PRESETS.map((pen) => {
              const selected = value.toLowerCase() === pen.hex.toLowerCase();
              return (
                <button
                  key={pen.hex}
                  type="button"
                  aria-label={`Caneta ${pen.label}`}
                  title={pen.label}
                  onClick={() => {
                    onChange(pen.hex);
                    setOpen(false);
                  }}
                  className={`w-10 h-10 rounded-full border-2 shadow-md transition-transform cursor-pointer flex items-center justify-center active:scale-90 ${
                    selected ? "border-white scale-110 ring-2 ring-black/20" : "border-white/70 hover:scale-105"
                  }`}
                  style={{ backgroundColor: pen.hex }}
                >
                  {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brush toggle — its ring reflects the currently active ink color */}
      <button
        id="pen-color-brush-toggle"
        type="button"
        aria-label="Escolher cor da caneta"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform border-2"
        style={{ borderColor: value }}
      >
        <Brush className="w-5 h-5" style={{ color: value }} />
      </button>
    </div>
  );
}
