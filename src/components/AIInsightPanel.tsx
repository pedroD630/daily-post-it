/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI-generated insights card. Silently renders NOTHING when no provider is
 * available so the surrounding rule-based Insights view stays clean on
 * browsers without Chrome Built-in AI and no user-provided key.
 *
 * Triggering is manual (a button) so we never burn quota / model resources
 * without the user asking. Result is cached in sessionStorage keyed by the
 * data fingerprint so re-entering the view doesn't retry unnecessarily.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, RefreshCw, AlertTriangle, Loader2, Info, CheckCircle2, XCircle } from "lucide-react";
import { Day, Goal } from "../types";
import { AIProvider, detectBestProvider, probeProviders, ProviderStatus } from "../utils/aiInsights";
import { buildInsightPrompt } from "../utils/aiPromptBuilder";

interface Props {
  days: Day[];
  goals: Goal[];
  pointsBalance: number;
  geminiApiKey?: string;
}

type State = "idle" | "loading" | "ready" | "error";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export default function AIInsightPanel({ days, goals, pointsBalance, geminiApiKey }: Props) {
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [detecting, setDetecting] = useState(true);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  // A tiny fingerprint of the numeric aggregates. Two clicks in a row on the
  // same data get the same result from cache; a completed task changes the
  // fingerprint and invalidates it.
  const fingerprint = useMemo(() => {
    const activeGoals = goals.filter((g) => !g.archived).length;
    const done = days.reduce((s, d) => s + d.tasks.filter((t) => t.completed).length, 0);
    const totalTasks = days.reduce((s, d) => s + d.tasks.length, 0);
    return `v1:${done}:${totalTasks}:${activeGoals}:${pointsBalance}`;
  }, [days, goals, pointsBalance]);

  useEffect(() => {
    let alive = true;
    setDetecting(true);
    Promise.all([detectBestProvider(geminiApiKey), probeProviders(geminiApiKey)])
      .then(([p, s]) => { if (alive) { setProvider(p); setStatus(s); } })
      .finally(() => { if (alive) setDetecting(false); });
    return () => { alive = false; };
  }, [geminiApiKey]);

  // Try to hydrate a cached result for this exact data fingerprint.
  useEffect(() => {
    if (!provider) return;
    try {
      const raw = sessionStorage.getItem(`ai_insight:${provider.kind}:${fingerprint}`);
      if (!raw) return;
      const cached = JSON.parse(raw) as { at: number; text: string };
      if (Date.now() - cached.at < CACHE_TTL_MS) {
        setResult(cached.text);
        setState("ready");
      }
    } catch {
      /* ignore cache read errors */
    }
  }, [provider, fingerprint]);

  if (detecting) return null;      // avoid flicker on first render

  // No provider available → show a discovery card explaining how to enable
  // one, plus a "Diagnostics" toggle that shows exactly which options are
  // blocked and why (huge time-saver for the app owner debugging deploys).
  if (!provider) {
    return (
      <section
        id="ai-insight-panel-setup"
        className="relative overflow-hidden rounded-2xl p-4 shadow-sm border border-indigo-200/60 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 dark:from-indigo-950/60 dark:via-purple-950/60 dark:to-fuchsia-950/60"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-4 h-4" />
            AI Analysis
          </h3>
          <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-500/70">
            not configured
          </span>
        </div>

        <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
          Análise por IA está disponível de 3 formas — nenhuma ativa neste dispositivo agora:
        </p>

        <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 mb-2">
          <li>• <strong>Cloud AI</strong>: proprietário do app deploya <code className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">supabase/functions/ai-insight</code> e liga <code className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">VITE_AI_PROXY_ENABLED=true</code> no Vercel</li>
          <li>• <strong>Chrome desktop 138+</strong>: roda no dispositivo, sem config</li>
          <li>• <strong>Sua chave Gemini</strong>: cole em Settings → Advanced: AI Insights (grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">AI Studio</a>)</li>
        </ul>

        <button
          type="button"
          onClick={() => setShowDiagnostics((v) => !v)}
          className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 cursor-pointer"
        >
          <Info className="w-3 h-3" />
          {showDiagnostics ? "esconder" : "ver"} diagnóstico
        </button>

        {showDiagnostics && status && (
          <div className="mt-2 p-2 rounded-lg bg-slate-900/5 dark:bg-black/30 border border-slate-200 dark:border-slate-700 space-y-1.5 font-mono text-[10.5px]">
            <DiagRow ok={status.chromeBuiltin.available} label="Chrome Built-in" detail={status.chromeBuiltin.reason} />
            <DiagRow
              ok={status.proxy.enabled && status.proxy.loggedIn}
              label="Cloud proxy"
              detail={
                !status.proxy.enabled
                  ? status.proxy.reason
                  : status.proxy.loggedIn
                  ? "ready"
                  : status.proxy.reason
              }
            />
            <DiagRow ok={status.byok.hasKey} label="BYOK key" detail={status.byok.hasKey ? "configured" : "no key in Settings"} />
          </div>
        )}
      </section>
    );
  }

  const run = async () => {
    if (!provider) return;
    setState("loading");
    setError("");
    try {
      const { system, user } = buildInsightPrompt(days, goals, pointsBalance);
      const text = await provider.generate(system, user);
      setResult(text);
      setState("ready");
      try {
        sessionStorage.setItem(
          `ai_insight:${provider.kind}:${fingerprint}`,
          JSON.stringify({ at: Date.now(), text })
        );
      } catch { /* ignore quota errors */ }
    } catch (err: any) {
      setError(String(err?.message || err));
      setState("error");
    }
  };

  return (
    <section
      id="ai-insight-panel"
      className="relative overflow-hidden rounded-2xl p-4 shadow-sm border border-indigo-200/60 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 dark:from-indigo-950/60 dark:via-purple-950/60 dark:to-fuchsia-950/60"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          <Sparkles className="w-4 h-4" />
          AI Analysis
        </h3>
        <span
          className="text-[9px] font-mono uppercase tracking-wider text-indigo-500/70 dark:text-indigo-400/70"
          title={
            provider.kind === "chrome-builtin"
              ? "Runs on your device via Gemini Nano — no data leaves your browser."
              : provider.kind === "supabase-proxy"
              ? "Sent to the app's secure backend, which calls Gemini on your behalf."
              : "Sent to Google Gemini API with the key you provided in Settings."
          }
        >
          {provider.label}
        </span>
      </div>

      {state === "idle" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-snug">
            {provider.kind === "chrome-builtin"
              ? "Análise privada, roda no seu dispositivo. Nada sai do navegador."
              : provider.kind === "supabase-proxy"
              ? "Análise via IA. Rápida e segura, sem configurar nada."
              : "Análise via Gemini API (chave sua). Free tier é generoso."}
          </p>
          <button
            type="button"
            onClick={run}
            className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm transition-colors"
          >
            Analisar
          </button>
        </div>
      )}

      {state === "loading" && (
        <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300 py-1">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analisando seus últimos 30 dias…</span>
        </div>
      )}

      {state === "ready" && (
        <div className="space-y-2">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-[13px] text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap"
          >
            {result}
          </motion.p>
          <button
            type="button"
            onClick={run}
            className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            regerar
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Não deu pra gerar a análise.</p>
            <p className="opacity-80 mt-1 font-mono text-[10px]">{error}</p>
            <button
              type="button"
              onClick={run}
              className="mt-1.5 underline cursor-pointer"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DiagRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
      {ok
        ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
        : <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />}
      <span className="font-semibold shrink-0">{label}:</span>
      <span className="opacity-80 break-all">{detail}</span>
    </div>
  );
}
