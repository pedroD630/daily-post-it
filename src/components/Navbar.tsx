/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { History, Plus, ShoppingBag, LayoutGrid } from "lucide-react";
import { AppView } from "../types";

interface NavbarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  currentUserPhoto?: string | null;
  onOpenPalette?: () => void;
}

export default function Navbar({ currentView, onViewChange, currentUserPhoto, onOpenPalette }: NavbarProps) {
  const itemClass = (active: boolean) =>
    `flex items-center justify-center w-11 h-12 rounded-xl transition-all duration-200 ${
      active
        ? "bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 shadow-md ring-1 ring-black/5 dark:ring-white/10 scale-105"
        : "text-stone-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 opacity-60 hover:opacity-100"
    }`;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-3 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md border-b border-black/5 dark:border-white/5"
      id="app-navbar"
    >
      <div className="w-full max-w-sm flex items-center justify-between" id="navbar-container">
        {/* History */}
        <button
          id="nav-btn-history"
          aria-label="View history"
          onClick={() => onViewChange("history")}
          className={itemClass(currentView === "history")}
        >
          <History className="w-5 h-5" />
        </button>

        {/* Progresso hub — metas, insights, checkpoints, streak */}
        <button
          id="nav-btn-progress"
          aria-label="Progresso"
          title="Progresso"
          onClick={() => onViewChange("progress")}
          className={itemClass(currentView === "progress" || currentView === "goals" || currentView === "streak" || currentView === "insights")}
        >
          <LayoutGrid className="w-5 h-5" />
        </button>

        {/* Center: Main View (+) */}
        <button
          id="nav-btn-main"
          aria-label="View current post-it"
          onClick={() => onViewChange("main")}
          className={`flex items-center justify-center w-14 h-12 rounded-2xl transition-all duration-200 ${
            currentView === "main"
              ? "bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 shadow-md ring-1 ring-black/5 dark:ring-white/10 scale-105"
              : "text-stone-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 opacity-60 hover:opacity-100"
          }`}
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Shop */}
        <button
          id="nav-btn-shop"
          aria-label="View reward shop"
          onClick={() => onViewChange("shop")}
          className={itemClass(currentView === "shop")}
        >
          <ShoppingBag className="w-5 h-5" />
        </button>

        {/* Profile (Settings agora vive aqui dentro) */}
        <button
          id="nav-btn-profile"
          aria-label="View user profile"
          onClick={() => onViewChange("profile")}
          className={`${itemClass(currentView === "profile")} overflow-hidden`}
        >
          {currentUserPhoto ? (
            <img
              src={currentUserPhoto}
              alt="Profile"
              referrerPolicy="no-referrer"
              className="w-6 h-6 rounded-full border border-stone-800/10"
            />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
}
