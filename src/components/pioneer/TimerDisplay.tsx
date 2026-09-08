/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shows the running stopwatch. The interval only repaints — the value is
 * recomputed from the stored start timestamp every tick, and again as soon
 * as the tab becomes visible, so throttling can make the display briefly
 * stale but never makes the recorded duration wrong.
 */

import React, { useEffect, useState } from "react";
import { getElapsedSeconds } from "../../utils/fieldTimer";

export default function TimerDisplay({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(() => getElapsedSeconds());

  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return;
    }
    setSeconds(getElapsedSeconds());
    const id = window.setInterval(() => setSeconds(getElapsedSeconds()), 1000);
    const onVisible = () => {
      if (!document.hidden) setSeconds(getElapsedSeconds());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={`font-mono tabular-nums text-4xl tracking-tight ${
        running ? "text-slate-900 dark:text-slate-50" : "text-slate-300 dark:text-slate-700"
      }`}
      aria-live="off"
    >
      {h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
    </div>
  );
}
