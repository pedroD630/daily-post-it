/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Optional privacy lock for the Streak tab. Quit-habits are intimate; some
 * users won't want them visible to anyone who picks up their phone. This is
 * a soft veil (device-local PIN in localStorage), NOT real security — it just
 * keeps casual eyes out. Unlock lasts for the browser session.
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShieldCheck, Lock, Delete } from "lucide-react";

const PIN_KEY = "streak_pin";
const SESSION_UNLOCK = "streak_unlocked";

export function getStreakPin(): string | null {
  try { return localStorage.getItem(PIN_KEY); } catch { return null; }
}
export function setStreakPin(pin: string | null) {
  try {
    if (pin) localStorage.setItem(PIN_KEY, pin);
    else { localStorage.removeItem(PIN_KEY); sessionStorage.removeItem(SESSION_UNLOCK); }
  } catch { /* ignore */ }
}

export default function StreakLockGate({ children }: { children: React.ReactNode }) {
  const [pin] = useState<string | null>(getStreakPin);
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (!getStreakPin()) return true;
    try { return sessionStorage.getItem(SESSION_UNLOCK) === "1"; } catch { return false; }
  });
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (entry.length === 4) {
      if (entry === pin) {
        try { sessionStorage.setItem(SESSION_UNLOCK, "1"); } catch { /* ignore */ }
        setUnlocked(true);
      } else {
        setError(true);
        setTimeout(() => { setEntry(""); setError(false); }, 500);
      }
    }
  }, [entry, pin]);

  if (unlocked) return <>{children}</>;

  const press = (d: string) => setEntry((e) => (e.length < 4 ? e + d : e));
  const back = () => setEntry((e) => e.slice(0, -1));

  return (
    <div className="w-full max-w-md mx-auto py-10 px-6 flex flex-col items-center gap-6 select-none">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="font-sans font-bold text-lg text-slate-800 dark:text-slate-100">Área protegida</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Digite seu PIN para ver seus hábitos.</p>
      </div>

      <motion.div
        animate={error ? { x: [-6, 6, -6, 6, 0] } : {}}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-3"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 ${
              i < entry.length
                ? error ? "bg-rose-500 border-rose-500" : "bg-slate-700 dark:bg-slate-200 border-slate-700 dark:border-slate-200"
                : "border-slate-300 dark:border-slate-600"
            }`}
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="w-16 h-16 rounded-full bg-white/80 dark:bg-slate-800/80 text-xl font-semibold text-slate-800 dark:text-slate-100 shadow-sm hover:bg-white dark:hover:bg-slate-700 cursor-pointer active:scale-95 transition-transform"
          >
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} className="w-16 h-16 rounded-full bg-white/80 dark:bg-slate-800/80 text-xl font-semibold text-slate-800 dark:text-slate-100 shadow-sm hover:bg-white dark:hover:bg-slate-700 cursor-pointer active:scale-95 transition-transform">0</button>
        <button type="button" aria-label="Apagar" onClick={back} className="w-16 h-16 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 cursor-pointer">
          <Delete className="w-5 h-5" />
        </button>
      </div>

      <span className="flex items-center gap-1 text-[11px] text-slate-400"><Lock className="w-3 h-3" /> Fica só neste dispositivo</span>
    </div>
  );
}
