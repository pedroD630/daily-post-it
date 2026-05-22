/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { History, Plus, Settings } from "lucide-react";
import { AppView } from "../types";

interface NavbarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export default function Navbar({ currentView, onViewChange }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-3 bg-white/40 backdrop-blur-md border-b border-black/5" id="app-navbar">
      <div className="w-full max-w-sm flex items-center justify-between" id="navbar-container">
        {/* Left: History Button */}
        <button
          id="nav-btn-history"
          aria-label="View history"
          onClick={() => onViewChange("history")}
          className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
            currentView === "history"
              ? "bg-white text-stone-900 shadow-md ring-1 ring-black/5 scale-105"
              : "text-stone-600 hover:bg-black/5 opacity-60 hover:opacity-100"
          }`}
        >
          <History className="w-5 h-5" />
        </button>

        {/* Center: Main View (+) Button */}
        <button
          id="nav-btn-main"
          aria-label="View current post-it"
          onClick={() => onViewChange("main")}
          className={`flex items-center justify-center w-14 h-12 rounded-2xl transition-all duration-200 ${
            currentView === "main"
              ? "bg-white text-stone-900 shadow-md ring-1 ring-black/5 scale-105"
              : "text-stone-600 hover:bg-black/5 opacity-60 hover:opacity-100"
          }`}
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Right: Settings Button */}
        <button
          id="nav-btn-settings"
          aria-label="View settings"
          onClick={() => onViewChange("settings")}
          className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
            currentView === "settings"
              ? "bg-white text-stone-900 shadow-md ring-1 ring-black/5 scale-105"
              : "text-stone-600 hover:bg-black/5 opacity-60 hover:opacity-100"
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
