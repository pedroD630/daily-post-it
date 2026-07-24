/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SOS modal — shows a random motivational quote when the user is at risk of
 * relapse. "Outra frase" loads a new one (never the same twice in a row).
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HeartPulse, X, RefreshCw } from "lucide-react";
import { getRandomQuote, Quote } from "../utils/quotePicker";

interface Props {
  open: boolean;
  onClose: () => void;
  habitName?: string;
}

export default function SOSModal({ open, onClose, habitName }: Props) {
  const [quote, setQuote] = useState<Quote>(() => getRandomQuote());

  // Fresh quote each time the modal opens.
  useEffect(() => {
    if (open) setQuote(getRandomQuote());
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sos-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="sos-card"
            role="dialog"
            aria-modal
            aria-label="Apoio motivacional"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="fixed z-[81] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2.5rem)] max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <HeartPulse className="w-5 h-5" />
                <span className="font-sans font-bold text-sm uppercase tracking-wider">Respira. Você consegue.</span>
              </div>
              <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {habitName && (
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-3">
                Firme em: {habitName}
              </p>
            )}

            <AnimatePresence mode="wait">
              <motion.blockquote
                key={quote.text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="text-lg leading-relaxed text-slate-800 dark:text-slate-100 font-serif"
              >
                &ldquo;{quote.text}&rdquo;
                <footer className="mt-3 text-sm text-slate-500 dark:text-slate-400 not-italic">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{quote.author}</span>
                  {quote.source && <span> — {quote.source}</span>}
                </footer>
              </motion.blockquote>
            </AnimatePresence>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setQuote(getRandomQuote())}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Outra frase
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
