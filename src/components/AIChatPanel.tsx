/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI Coach — single persistent chat about the user's productivity.
 * Persisted locally (IndexedDB) so the conversation survives reloads.
 * Not multi-thread by design: one ongoing conversation per user, per spec.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Send, Loader2, AlertTriangle, Info, CheckCircle2, XCircle, Trash2, Bot, User as UserIcon } from "lucide-react";
import { Day, Goal } from "../types";
import { AIProvider, ChatMessage, detectBestProvider, probeProviders, ProviderStatus } from "../utils/aiInsights";
import { buildSystemPrompt, buildWelcomeMessage } from "../utils/aiPromptBuilder";
import { getAIChatHistory, saveAIChatHistory, clearAIChatHistory, AIChatMessageRecord } from "../db";

interface Props {
  days: Day[];
  goals: Goal[];
  pointsBalance: number;
  geminiApiKey?: string;
}

export default function AIChatPanel({ days, goals, pointsBalance, geminiApiKey }: Props) {
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [detecting, setDetecting] = useState(true);

  const [messages, setMessages] = useState<AIChatMessageRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Detect provider once (re-checks if the BYOK key changes in Settings).
  // Safety timeout so a hung dynamic import / auth probe can't keep the
  // panel invisible forever.
  useEffect(() => {
    let alive = true;
    setDetecting(true);
    const safety = setTimeout(() => { if (alive) setDetecting(false); }, 4000);
    Promise.all([detectBestProvider(geminiApiKey), probeProviders(geminiApiKey)])
      .then(([p, s]) => { if (alive) { setProvider(p); setStatus(s); } })
      .catch((e) => console.warn("AI provider detection failed:", e))
      .finally(() => { if (alive) { clearTimeout(safety); setDetecting(false); } });
    return () => { alive = false; clearTimeout(safety); };
  }, [geminiApiKey]);

  // Load persisted conversation once. A safety timeout guarantees the panel
  // renders even if IndexedDB hangs (e.g. a blocked v3→v4 upgrade held open
  // by another tab) — better to show an empty chat than to silently vanish.
  useEffect(() => {
    let alive = true;
    const safety = setTimeout(() => { if (alive) setHydrated(true); }, 3000);
    getAIChatHistory()
      .then((history) => { if (alive) setMessages(history); })
      .catch((e) => console.warn("AI chat history load failed:", e))
      .finally(() => { if (alive) { clearTimeout(safety); setHydrated(true); } });
    return () => { alive = false; clearTimeout(safety); };
  }, []);

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  if (detecting || !hydrated) return null; // avoid flicker on first render

  // ---------------------------------------------------------------------
  // No provider available → discovery card with live diagnostics.
  // ---------------------------------------------------------------------
  if (!provider) {
    return (
      <section
        id="ai-chat-panel-setup"
        className="relative overflow-hidden rounded-2xl p-4 shadow-sm border border-indigo-200/60 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 dark:from-indigo-950/60 dark:via-purple-950/60 dark:to-fuchsia-950/60"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-4 h-4" />
            Coach IA
          </h3>
          <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-500/70">
            not configured
          </span>
        </div>

        <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
          O chat com IA ainda não está disponível neste dispositivo.
        </p>

        <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 mb-2">
          <li>• <strong>Coach IA (padrão)</strong>: proprietário do app deploya <code className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">supabase/functions/ai-insight</code> e liga <code className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">VITE_AI_PROXY_ENABLED=true</code> no Vercel</li>
          <li>• <strong>Sua própria chave</strong>: cole em Settings → Advanced: AI Insights (grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">AI Studio</a>)</li>
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
            <DiagRow
              ok={status.proxy.enabled && status.proxy.loggedIn}
              label="Coach IA (proxy)"
              detail={!status.proxy.enabled ? status.proxy.reason : status.proxy.loggedIn ? "ready" : status.proxy.reason}
            />
            <DiagRow ok={status.byok.hasKey} label="BYOK key" detail={status.byok.hasKey ? "configured" : "no key in Settings"} />
          </div>
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------------
  // Chat UI
  // ---------------------------------------------------------------------

  const persist = async (next: AIChatMessageRecord[]) => {
    setMessages(next);
    try { await saveAIChatHistory(next); } catch (e) { console.warn("Failed to persist AI chat:", e); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !provider) return;
    setError("");
    setInput("");

    const userMsg: AIChatMessageRecord = { role: "user", text, ts: Date.now() };
    const withUser = [...messages, userMsg];
    await persist(withUser);
    setSending(true);

    try {
      const system = buildSystemPrompt(days, goals, pointsBalance);
      const history: ChatMessage[] = withUser.map((m) => ({ role: m.role, text: m.text }));
      const reply = await provider.chat(system, history);
      const modelMsg: AIChatMessageRecord = { role: "model", text: reply, ts: Date.now() };
      await persist([...withUser, modelMsg]);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Apagar toda a conversa com o Coach IA?")) return;
    await clearAIChatHistory();
    setMessages([]);
    setError("");
  };

  const welcome = messages.length === 0 ? buildWelcomeMessage(days, goals) : null;

  return (
    <section
      id="ai-chat-panel"
      className="relative overflow-hidden rounded-2xl shadow-sm border border-indigo-200/60 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 dark:from-indigo-950/60 dark:via-purple-950/60 dark:to-fuchsia-950/60 flex flex-col"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-indigo-200/40 dark:border-indigo-800/40">
        <h3 className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          <Sparkles className="w-4 h-4" />
          Coach IA
        </h3>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-mono uppercase tracking-wider text-indigo-500/70 dark:text-indigo-400/70"
            title={
              provider.kind === "supabase-proxy"
                ? "Análise processada pelo backend do app — nenhuma configuração necessária."
                : "Enviado à Gemini API com a chave que você configurou em Settings."
            }
          >
            {provider.label}
          </span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpar conversa"
              title="Limpar conversa"
              className="text-slate-400 hover:text-red-500 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex flex-col gap-2.5 px-4 py-3 max-h-80 overflow-y-auto">
        {welcome && <ChatBubble role="model" text={welcome} />}
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} text={m.text} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300 pl-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Pensando…</span>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 rounded-lg p-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-indigo-200/40 dark:border-indigo-800/40">
        <input
          id="ai-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Pergunte sobre suas metas, consistência, prioridades…"
          disabled={sending}
          className="flex-1 bg-white/70 dark:bg-slate-900/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          aria-label="Enviar"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

function ChatBubble({ role, text }: { key?: React.Key; role: "user" | "model"; text: string }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
        isUser ? "bg-slate-700 text-white" : "bg-indigo-600 text-white"
      }`}>
        {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
        isUser
          ? "bg-slate-800 text-white rounded-tr-sm"
          : "bg-white/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 rounded-tl-sm"
      }`}>
        {text}
      </div>
    </motion.div>
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
