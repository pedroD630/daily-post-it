/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Field-service stopwatch.
 *
 * The timer NEVER counts ticks. It stores the start timestamp and derives
 * elapsed time from the system clock, because browsers throttle background
 * timers (Chrome drops inactive tabs to one tick per second, then one per
 * minute) and mobile Safari may discard the tab outright. A tick-counting
 * stopwatch would silently under-report a two-hour outing.
 *
 * The setInterval in the UI only refreshes the display; if it is throttled
 * the number on screen goes stale for a moment, but the recorded duration
 * stays exact because it is always recomputed from the timestamp.
 */

const TIMER_KEY = "pioneer_active_timer";

export interface ActiveTimer {
  startedAt: number;
}

export function startTimer(): ActiveTimer {
  const timer: ActiveTimer = { startedAt: Date.now() };
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  } catch {
    /* storage blocked — the timer still runs for this session */
  }
  return timer;
}

export function getActiveTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveTimer;
    // A corrupt or future-dated stamp would produce nonsense durations.
    if (typeof parsed?.startedAt !== "number" || parsed.startedAt > Date.now() + 60000) {
      localStorage.removeItem(TIMER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getElapsedSeconds(): number {
  const timer = getActiveTimer();
  if (!timer) return 0;
  return Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
}

export function getElapsedMinutes(): number {
  return Math.floor(getElapsedSeconds() / 60);
}

export function clearTimer(): void {
  try {
    localStorage.removeItem(TIMER_KEY);
  } catch {
    /* ignore */
  }
}

/** Stops the timer and returns the duration it measured. */
export function stopTimer(): { hours: number; minutes: number; totalMinutes: number } | null {
  const timer = getActiveTimer();
  if (!timer) return null;
  const totalMinutes = Math.max(0, Math.floor((Date.now() - timer.startedAt) / 60000));
  clearTimer();
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60, totalMinutes };
}

/* --- Wake lock ---------------------------------------------------------- */
// Best-effort only: it reduces the chance the tab is discarded mid-outing.
// The timer is correct with or without it, so every failure is swallowed.

let wakeLock: { release?: () => Promise<void> } | null = null;

export async function requestWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<any> } };
    if (nav.wakeLock) wakeLock = await nav.wakeLock.request("screen");
  } catch {
    /* unsupported or denied */
  }
}

export function releaseWakeLock(): void {
  try {
    void wakeLock?.release?.();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}
