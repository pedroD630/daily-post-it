/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { User } from "firebase/auth";
import {
  googleSignIn,
  logout,
  isCalendarConnected,
  setCalendarConnected,
  fetchGoogleCalendarEvents
} from "../db/firebase";
import { Day, AppView } from "../types";
import { Calendar, Cloud, Database, Info, LogOut, ShieldAlert, Sparkles, User as UserIcon } from "lucide-react";

interface ProfileViewProps {
  historyDays: Day[];
  todayDay: Day | null;
  currentUser: User | null;
  onRefreshData: () => Promise<void>;
  onViewChange: (view: AppView) => void;
}

export default function ProfileView({
  historyDays,
  todayDay,
  currentUser,
  onRefreshData,
  onViewChange
}: ProfileViewProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [calendarConnected, setCalendarConnectedState] = useState(isCalendarConnected());
  const [lastSyncedStr, setLastSyncedStr] = useState<string>("Synced just now");
  const [calendarCount, setCalendarCount] = useState<number | null>(null);

  // Calculate live statistics
  const totalDays = historyDays.length + (todayDay ? 1 : 0);
  const totalTasks = [todayDay, ...historyDays].reduce((acc, curr) => {
    if (!curr) return acc;
    return acc + curr.tasks.length;
  }, 0);

  // Sync Calendar events counts or presence to show immediate value
  useEffect(() => {
    let active = true;
    if (currentUser && calendarConnected) {
      fetchGoogleCalendarEvents().then(events => {
        if (active) {
          setCalendarCount(events.length);
        }
      }).catch(err => console.error(err));
    } else {
      setCalendarCount(null);
    }
    return () => {
      active = false;
    };
  }, [currentUser, calendarConnected]);

  const handleLogin = () => {
    setIsLoggingIn(true);
    googleSignIn().catch((err) => {
      console.error("Login failed:", err);
      setIsLoggingIn(false);
    });
  };

  const handleSignOut = async () => {
    if (window.confirm("Are you sure you want to sign out? Your notes will remain secure on this device.")) {
      try {
        await logout();
        await onRefreshData();
      } catch (err) {
        console.error("Sign out failed:", err);
      }
    }
  };

  const handleToggleCalendar = () => {
    const newState = !calendarConnected;
    setCalendarConnectedState(newState);
    setCalendarConnected(newState);
    if (!newState) {
      setCalendarCount(null);
    }
  };

  if (!currentUser) {
    // Unauthenticated view: Login Screen
    return (
      <div
        id="profile-login-card"
        className="w-full max-w-md bg-[#fffdf6] border border-black/10 rounded-3xl p-8 flex flex-col items-center justify-center select-none"
        style={{
          boxShadow: `
            0 4px 6px rgba(0,0,0,0.05),
            0 10px 20px rgba(0,0,0,0.04),
            0 1px 2px rgba(0,0,0,0.03)
          `
        }}
      >
        {/* App Logo / Post-it Symbol */}
        <div className="relative w-20 h-20 bg-amber-100 hover:bg-amber-200 border-2 border-stone-800 rotate-3 transition-transform duration-300 rounded-xl flex items-center justify-center shadow-md mb-6 shrink-0">
          <div className="absolute right-[-2px] bottom-[-2px] w-6 h-6 bg-[#fcf6e8] border-t-2 border-l-2 border-stone-800 rounded-br-lg rotate-18" />
          <span className="font-handwritten text-4xl text-stone-900 select-none">✎</span>
        </div>

        <h2 className="font-sans font-bold text-2xl text-stone-900 tracking-tight text-center mb-1">
          Daily Post-it Sync
        </h2>
        
        <p className="font-sans text-xs text-stone-500 text-center uppercase tracking-widest font-semibold mb-8">
          Personal Workspace
        </p>

        {/* Continue with Google button formatted exactly according to official identity guidelines */}
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          id="profile-gsi-button"
          aria-label="Continue with Google"
          className="flex items-center justify-between w-full max-w-sm h-11 bg-white hover:bg-slate-50 border border-[#dadce0] rounded-xl px-4 text-stone-700 shadow-sm transition-all duration-150 cursor-pointer text-sm font-semibold hover:border-slate-300 disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-[18px] h-[18px] block shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
            <span>{isLoggingIn ? "Signing you in..." : "Continue with Google"}</span>
          </div>
          <span className="text-stone-400 font-sans font-light select-none">→</span>
        </button>

        {/* Footer info text specified in requirement */}
        <p className="font-sans text-xs text-stone-500 text-center leading-relaxed max-w-[280px] mt-8 opacity-75">
          Your notes stay on this device. Sign in to sync across devices and connect Google Calendar.
        </p>
      </div>
    );
  }

  // Authenticated View: User Profile
  return (
    <div
      id="profile-dashboard-card"
      className="w-full max-w-md bg-[#fffdf6] border border-black/10 rounded-3xl p-6 flex flex-col gap-6"
      style={{
        boxShadow: `
          0 4px 6px rgba(0,0,0,0.05),
          0 10px 20px rgba(0,0,0,0.04),
          0 1px 2px rgba(0,0,0,0.03)
        `
      }}
    >
      {/* Profile Header Block */}
      <div className="flex items-center gap-4 pb-4 border-b border-black/5" id="profile-user-header">
        {currentUser.photoURL ? (
          <img
            src={currentUser.photoURL}
            alt={currentUser.displayName || "Avatar"}
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full border-2 border-[#1f2937]/10"
            id="profile-avatar-img"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-full border border-stone-300 bg-stone-100 flex items-center justify-center text-xl text-stone-600 font-bold uppercase select-none"
            id="profile-avatar-fallback"
          >
            {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || "?"}
          </div>
        )}
        <div className="flex flex-col select-all">
          <h3 className="font-sans font-bold text-stone-900 tracking-tight leading-tight">
            {currentUser.displayName || "Device Owner"}
          </h3>
          <span className="font-sans text-xs text-stone-500">
            {currentUser.email}
          </span>
        </div>
      </div>

      {/* Google Calendar Section */}
      <div className="flex flex-col gap-3" id="profile-calendar-integration">
        <div className="flex items-center justify-between border-b border-stone-200 pb-1">
          <span className="font-sans text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5 select-none">
            <Calendar className="w-4 h-4 text-stone-500" />
            Google Calendar
          </span>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between py-1" id="calendar-status-row">
            <div className="flex items-center gap-2">
              <span 
                className={`w-2 h-2 rounded-full transition-colors ${
                  calendarConnected ? "bg-emerald-500 animate-pulse" : "bg-stone-300"
                }`} 
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-stone-700">
                {calendarConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            {calendarConnected && calendarCount !== null && (
              <span className="text-[10px] bg-amber-100 border border-stone-200 px-2 py-0.5 rounded-full font-mono text-stone-700 select-none">
                {calendarCount} {calendarCount === 1 ? "event" : "events"} today
              </span>
            )}
          </div>
          
          <p className="text-xs text-stone-500 select-none">
            {calendarConnected 
              ? "Your tasks can now connect with Google Calendar timeline inputs dynamically on your daily canvas." 
              : "Direct link to automatically populate, display, and manage calendar markers directly on your notes."
            }
          </p>

          <button
            onClick={handleToggleCalendar}
            id="profile-btn-disconnect-cal"
            className={`w-full py-2.5 rounded-xl border text-xs font-semibold select-none shadow-sm cursor-pointer transition-all ${
              calendarConnected
                ? "bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300/60"
                : "bg-stone-800 hover:bg-stone-900 text-white border-transparent"
            }`}
          >
            {calendarConnected ? "Disconnect" : "Connect Google Calendar"}
          </button>
        </div>
      </div>

      {/* Data Section */}
      <div className="flex flex-col gap-3" id="profile-data-metrics">
        <div className="flex items-center justify-between border-b border-stone-200 pb-1">
          <span className="font-sans text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5 select-none">
            <Database className="w-4 h-4 text-stone-500" />
            Workspace Storage
          </span>
          <span className="text-[10px] shadow-sm font-mono bg-stone-100 border px-1.5 py-0.5 rounded text-stone-500 select-none flex items-center gap-1">
            <Cloud className="w-3 h-3" /> Auto-sync enabled
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4" id="profile-metrics-grid">
          <div className="bg-stone-50 border border-black/5 rounded-2xl p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-sans text-stone-900">
              {totalDays}
            </span>
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mt-1 text-center select-none">
              Post-its stored
            </span>
          </div>

          <div className="bg-stone-50 border border-black/5 rounded-2xl p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-sans text-stone-900">
              {totalTasks}
            </span>
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mt-1 text-center select-none">
              Tasks created
            </span>
          </div>
        </div>
      </div>

      {/* Synchronized status details */}
      <div className="flex items-center gap-2 p-3 bg-[#fff7d6] border border-[#ece3b2] rounded-2xl text-stone-700" id="profile-synced-banner">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 select-none animate-pulse" />
        <p className="text-xs leading-normal">
          {lastSyncedStr}. Your notes are securely mirrored in Supabase (PostgreSQL) for instant multidevice backup.
        </p>
      </div>

      {/* Footer Navigation Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-black/5" id="profile-action-footer">
        <button
          onClick={handleSignOut}
          id="profile-btn-signout"
          aria-label="Sign out of account"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-300/40 text-red-600 font-semibold text-xs hover:bg-red-50 hover:border-red-300 transition-all shadow-sm cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>

        <button
          onClick={() => onViewChange("main")}
          id="profile-btn-back-workspace"
          aria-label="Return to active post-it workspace"
          className="flex-1 text-center py-2.5 bg-stone-900 hover:bg-stone-950 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
        >
          Back To Notes
        </button>
      </div>
    </div>
  );
}
