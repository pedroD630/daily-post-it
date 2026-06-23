/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Command Palette — Ctrl/Cmd+K.
 *
 * One input, three result groups:
 *   1. Quick actions (navigation, new task, theme & palette switching)
 *   2. Matching tasks across ALL days (today + history), with jump-to-day
 *   3. Day notes that match
 *
 * Fully keyboard driven: ↑/↓ to move, Enter to run, Esc to close.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Plus, StickyNote, History, ShoppingBag, Settings as SettingsIcon,
  User as UserIcon, BarChart3, SunMedium, Moon, MonitorSmartphone,
  Palette as PaletteIcon, Layers, CheckCircle2, Circle, CornerDownLeft,
  RefreshCw,
} from "lucide-react";
import { Day, AppView, ThemeMode } from "../types";
import { PALETTES } from "../constants/palettes";

export interface PaletteCommandContext {
  setView: (view: AppView) => void;
  newTask: () => void;
  setTheme: (theme: ThemeMode) => void;
  setColorPalette: (paletteId: string) => void;
  togglePaperTexture: () => void;
  jumpToDay: (dayId: string) => void;
  forceSync: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  days: Day[]; // today first, then history (any order is fine)
  todayId: string;
  ctx: PaletteCommandContext;
}

interface ActionItem {
  kind: "action";
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords: string;
  run: () => void;
}

interface TaskItemResult {
  kind: "task";
  id: string;
  text: string;
  completed: boolean;
  dayId: string;
  dayLabel: string;
  isToday: boolean;
}

interface NoteItemResult {
  kind: "note";
  id: string;
  text: string;
  dayId: string;
  dayLabel: string;
  isToday: boolean;
}

type ResultItem = ActionItem | TaskItemResult | NoteItemResult;

export default function CommandPalette({ open, onClose, days, todayId, ctx }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      // Focus after the entrance animation kicks in
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const actions: ActionItem[] = useMemo(() => {
    const close = (fn: () => void) => () => { fn(); onClose(); };
    const items: ActionItem[] = [
      { kind: "action", id: "new-task", label: "New task", hint: "today's post-it", icon: <Plus className="w-4 h-4" />, keywords: "new task add create todo nova tarefa adicionar criar", run: close(() => { ctx.setView("main"); ctx.newTask(); }) },
      { kind: "action", id: "force-sync", label: "Force sync from cloud", hint: "pull latest", icon: <RefreshCw className="w-4 h-4" />, keywords: "sync refresh pull cloud sincronizar atualizar nuvem", run: close(() => ctx.forceSync()) },
      { kind: "action", id: "go-today", label: "Go to Today", icon: <StickyNote className="w-4 h-4" />, keywords: "today main post-it hoje principal", run: close(() => ctx.setView("main")) },
      { kind: "action", id: "go-history", label: "Go to History", icon: <History className="w-4 h-4" />, keywords: "history past days histórico passado", run: close(() => ctx.setView("history")) },
      { kind: "action", id: "go-insights", label: "Go to Insights", hint: "streak & stats", icon: <BarChart3 className="w-4 h-4" />, keywords: "insights stats statistics streak chart estatísticas gráfico", run: close(() => ctx.setView("insights")) },
      { kind: "action", id: "go-shop", label: "Go to Reward Shop", icon: <ShoppingBag className="w-4 h-4" />, keywords: "shop rewards points loja recompensas pontos", run: close(() => ctx.setView("shop")) },
      { kind: "action", id: "go-settings", label: "Go to Settings", icon: <SettingsIcon className="w-4 h-4" />, keywords: "settings appearance configurações aparência", run: close(() => ctx.setView("settings")) },
      { kind: "action", id: "go-profile", label: "Go to Profile", icon: <UserIcon className="w-4 h-4" />, keywords: "profile account sync perfil conta", run: close(() => ctx.setView("profile")) },
      { kind: "action", id: "theme-light", label: "Theme: Light", icon: <SunMedium className="w-4 h-4" />, keywords: "theme light claro tema", run: close(() => ctx.setTheme("light")) },
      { kind: "action", id: "theme-dark", label: "Theme: Dark", icon: <Moon className="w-4 h-4" />, keywords: "theme dark escuro tema noite", run: close(() => ctx.setTheme("dark")) },
      { kind: "action", id: "theme-system", label: "Theme: System", icon: <MonitorSmartphone className="w-4 h-4" />, keywords: "theme system auto sistema tema", run: close(() => ctx.setTheme("system")) },
      { kind: "action", id: "toggle-texture", label: "Toggle paper texture", icon: <Layers className="w-4 h-4" />, keywords: "texture paper shader textura papel", run: close(() => ctx.togglePaperTexture()) },
    ];
    for (const p of PALETTES) {
      items.push({
        kind: "action",
        id: `palette-${p.id}`,
        label: `Palette: ${p.name}`,
        icon: <PaletteIcon className="w-4 h-4" />,
        keywords: `palette colors paleta cores ${p.name.toLowerCase()}`,
        run: close(() => ctx.setColorPalette(p.id)),
      });
    }
    return items;
  }, [ctx, onClose]);

  const { actionResults, taskResults, noteResults } = useMemo(() => {
    const q = query.trim().toLowerCase();

    const actionResults = q
      ? actions.filter((a) => a.label.toLowerCase().includes(q) || a.keywords.includes(q))
      : actions.slice(0, 7); // default: the most useful shortcuts

    const taskResults: TaskItemResult[] = [];
    const noteResults: NoteItemResult[] = [];
    if (q.length >= 2) {
      // Newest days first so recent work ranks higher
      const sorted = [...days].sort((a, b) => b.id.localeCompare(a.id));
      for (const day of sorted) {
        const isToday = day.id === todayId;
        const dayLabel = isToday ? "Today" : day.date;
        for (const task of day.tasks) {
          if (task.text.toLowerCase().includes(q)) {
            taskResults.push({
              kind: "task",
              id: `${day.id}/${task.id}`,
              text: task.text,
              completed: task.completed,
              dayId: day.id,
              dayLabel,
              isToday,
            });
            if (taskResults.length >= 12) break;
          }
        }
        if (day.note && day.note.toLowerCase().includes(q) && noteResults.length < 5) {
          noteResults.push({
            kind: "note",
            id: `note-${day.id}`,
            text: day.note,
            dayId: day.id,
            dayLabel,
            isToday,
          });
        }
        if (taskResults.length >= 12) break;
      }
    }
    return { actionResults, taskResults, noteResults };
  }, [query, actions, days, todayId]);

  const flatResults: ResultItem[] = useMemo(
    () => [...actionResults, ...taskResults, ...noteResults],
    [actionResults, taskResults, noteResults]
  );

  useEffect(() => setHighlight(0), [query]);

  const runItem = (item: ResultItem) => {
    if (item.kind === "action") {
      item.run();
    } else {
      ctx.jumpToDay(item.dayId);
      onClose();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatResults[highlight];
      if (item) runItem(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Keep the highlighted row in view while arrowing through long lists
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const renderRow = (item: ResultItem, idx: number) => {
    const isActive = idx === highlight;
    const base = `flex items-center gap-3 px-3.5 py-2.5 mx-2 rounded-xl cursor-pointer text-sm transition-colors ${
      isActive
        ? "bg-amber-100/80 dark:bg-slate-700/70 text-slate-900 dark:text-slate-50"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
    }`;

    if (item.kind === "action") {
      return (
        <div key={item.id} data-idx={idx} className={base} onClick={() => runItem(item)} onMouseEnter={() => setHighlight(idx)}>
          <span className="shrink-0 opacity-70">{item.icon}</span>
          <span className="flex-1 font-medium">{item.label}</span>
          {item.hint && <span className="text-[10px] font-mono opacity-50">{item.hint}</span>}
          {isActive && <CornerDownLeft className="w-3.5 h-3.5 opacity-40" />}
        </div>
      );
    }

    const icon =
      item.kind === "note" ? (
        <StickyNote className="w-4 h-4 text-amber-500" />
      ) : item.completed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : (
        <Circle className="w-4 h-4 opacity-50" />
      );

    return (
      <div key={item.id} data-idx={idx} className={base} onClick={() => runItem(item)} onMouseEnter={() => setHighlight(idx)}>
        <span className="shrink-0">{icon}</span>
        <span className={`flex-1 truncate ${item.kind === "task" && item.completed ? "line-through opacity-60" : ""}`}>
          {item.text}
        </span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
          item.isToday
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}>
          {item.dayLabel}
        </span>
      </div>
    );
  };

  let runningIdx = -1;
  const nextIdx = () => ++runningIdx;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] bg-black/35 dark:bg-black/55 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            key="cp-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed z-[71] left-1/2 -translate-x-1/2 top-[12vh] w-[calc(100%-2rem)] max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onKeyDown={onKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                id="command-palette-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks, notes, or type a command..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden md:block text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-2">
              {actionResults.length > 0 && (
                <>
                  <p className="px-5 pt-1 pb-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 select-none">Actions</p>
                  {actionResults.map((a) => renderRow(a, nextIdx()))}
                </>
              )}

              {taskResults.length > 0 && (
                <>
                  <p className="px-5 pt-3 pb-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 select-none">Tasks</p>
                  {taskResults.map((t) => renderRow(t, nextIdx()))}
                </>
              )}

              {noteResults.length > 0 && (
                <>
                  <p className="px-5 pt-3 pb-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 select-none">Notes</p>
                  {noteResults.map((n) => renderRow(n, nextIdx()))}
                </>
              )}

              {flatResults.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-slate-400 select-none">
                  Nothing found for &ldquo;{query}&rdquo;
                </p>
              )}
            </div>

            {/* Footer hints */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-400 select-none">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span className="ml-auto">ctrl+k anytime</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
