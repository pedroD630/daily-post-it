/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Segmented control for the main screen: post-it or Kanban board.
 */

import React from "react";
import { StickyNote, Columns3 } from "lucide-react";

export type MainViewMode = "postit" | "board";

const STORAGE_KEY = "main_view_mode";

/** Interface preference, not user data — stays on this device. */
export function getStoredViewMode(): MainViewMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "board" ? "board" : "postit";
  } catch {
    return "postit";
  }
}

export function storeViewMode(mode: MainViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* private mode — the toggle still works for this session */
  }
}

interface Props {
  mode: MainViewMode;
  onChange: (mode: MainViewMode) => void;
}

export default function ViewToggle({ mode, onChange }: Props) {
  const item = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
      active
        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
    }`;

  return (
    <div
      id="main-view-toggle"
      role="tablist"
      aria-label="Modo de visualização"
      className="flex gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 backdrop-blur-sm w-fit mx-auto"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "postit"}
        onClick={() => onChange("postit")}
        className={item(mode === "postit")}
      >
        <StickyNote className="w-3.5 h-3.5" /> Post-it
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "board"}
        onClick={() => onChange("board")}
        className={item(mode === "board")}
      >
        <Columns3 className="w-3.5 h-3.5" /> Quadro
      </button>
    </div>
  );
}
