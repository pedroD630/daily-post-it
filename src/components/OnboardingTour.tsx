/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * First-run onboarding. A new user lands on an empty post-it with no idea
 * that pen colors carry different points, that midnight penalizes unfinished
 * tasks, or that goals / AI coach / streak exist. A short skippable tour
 * sets the mental model. Shown once (localStorage flag).
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { StickyNote, Sparkles, ShieldCheck, Trophy, ArrowRight, X } from "lucide-react";

const SEEN_KEY = "onboarding_seen_v1";

export function hasSeenOnboarding(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return true; }
}
export function markOnboardingSeen() {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
}

interface Slide {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    icon: <StickyNote className="w-7 h-7" />,
    title: "Um post-it por dia",
    body: "Escreva as tarefas do dia. A cor da caneta (preto/azul/vermelho) vale pontos diferentes ao concluir — e tarefas não feitas até a meia-noite descontam pontos. Gaste os pontos na Loja.",
    accent: "#f59e0b",
  },
  {
    icon: <Trophy className="w-7 h-7" />,
    title: "Metas de longo prazo",
    body: "Cadastre metas com palavras-chave. Toda tarefa concluída que combine com elas conta como progresso. Veja seu ritmo, streak e estatísticas na aba de metas.",
    accent: "#0ea5e9",
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    title: "Coach de IA",
    body: "Converse com o coach sobre seu desempenho. Ele analisa suas tarefas e metas, sugere prioridades e pode propor etapas (checkpoints) para você bater cada objetivo.",
    accent: "#6366f1",
  },
  {
    icon: <ShieldCheck className="w-7 h-7" />,
    title: "Streak de hábitos",
    body: "Quer largar um vício? Acompanhe seus dias limpos rumo a 90, com marcos em 30 e 60. No momento de fraqueza, o botão SOS mostra frases que ajudam.",
    accent: "#10b981",
  },
];

export default function OnboardingTour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  const finish = () => { markOnboardingSeen(); onDone(); };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-5 bg-black/55 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6"
        role="dialog"
        aria-modal
        aria-label="Bem-vindo ao Daily Post-it"
      >
        <div className="flex justify-end">
          <button type="button" aria-label="Pular" onClick={finish} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col items-center text-center gap-3 px-2 pb-2"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: slide.accent }}>
              {slide.icon}
            </div>
            <h2 className="font-sans font-bold text-lg text-slate-900 dark:text-slate-100">{slide.title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 my-5">
          {SLIDES.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-slate-800 dark:bg-slate-100" : "w-1.5 bg-slate-300 dark:bg-slate-700"}`} />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={finish} className="flex-1 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            Pular
          </button>
          <button
            type="button"
            onClick={() => (last ? finish() : setI((v) => v + 1))}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white shadow cursor-pointer"
          >
            {last ? "Começar" : "Próximo"}
            {!last && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
