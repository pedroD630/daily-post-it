/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Decides whether the affirmations screen is due right now.
 *
 * Deliberately uses `todayISO()` (local calendar date) rather than
 * `toISOString().slice(0,10)` (UTC). In UTC-3 the UTC date rolls over at
 * 21:00 local, which sits inside the evening window — a UTC key would make
 * the session confirmed at 19:00 look unconfirmed again at 21:30.
 *
 * The "done" marks are per-device on purpose: confirming your evening
 * affirmations on the phone shouldn't silently tick the box on the laptop.
 * That's why they live in localStorage and not in the synced stores.
 */

import { todayISO } from "./streakCalculator";

export type AffirmationSession = "morning" | "evening";

const MORNING_START = 6;
const MORNING_END = 12;   // exclusive
const EVENING_START = 18; // runs to midnight

export function getCurrentSession(now: Date = new Date()): AffirmationSession | null {
  const hour = now.getHours();
  if (hour >= MORNING_START && hour < MORNING_END) return "morning";
  if (hour >= EVENING_START) return "evening";
  return null;
}

function sessionKey(session: AffirmationSession): string {
  return `affirmation_${session}_${todayISO()}`;
}

export function isSessionDone(session: AffirmationSession): boolean {
  try {
    return localStorage.getItem(sessionKey(session)) === "done";
  } catch {
    return false; // private mode / storage blocked — just show it
  }
}

export function markSessionDone(session: AffirmationSession): void {
  try {
    localStorage.setItem(sessionKey(session), "done");
  } catch {
    /* storage unavailable — the modal simply reappears next launch */
  }
}

/** The session that is currently due, or null if there's nothing to show. */
export function getPendingSession(now: Date = new Date()): AffirmationSession | null {
  const session = getCurrentSession(now);
  if (!session || isSessionDone(session)) return null;
  return session;
}

export const SESSION_GREETING: Record<AffirmationSession, { emoji: string; text: string }> = {
  morning: { emoji: "🌅", text: "Bom dia" },
  evening: { emoji: "🌙", text: "Boa noite" },
};
