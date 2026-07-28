/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Subtle cloud-sync status pill. Shows "syncing" while a cloud refresh is in
 * flight and a brief "synced" confirmation after, then fades out. Surfaces
 * "offline" when the network is down. Gives the user confidence their data
 * is safe — especially valuable given how much sync logic runs invisibly.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Cloud, CloudOff, Check, Loader2 } from "lucide-react";

export type SyncState = "idle" | "syncing" | "synced" | "offline";

export default function SyncIndicator({ state }: { state: SyncState }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state === "syncing" || state === "offline") {
      setVisible(true);
      return;
    }
    if (state === "synced") {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 1600);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [state]);

  const config =
    state === "syncing"
      ? { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "Sincronizando", cls: "text-slate-500" }
      : state === "synced"
      ? { icon: <Check className="w-3 h-3" />, label: "Sincronizado", cls: "text-emerald-600 dark:text-emerald-400" }
      : state === "offline"
      ? { icon: <CloudOff className="w-3 h-3" />, label: "Offline", cls: "text-amber-600 dark:text-amber-400" }
      : { icon: <Cloud className="w-3 h-3" />, label: "", cls: "text-slate-400" };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={state}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          className={`fixed top-[4.2rem] right-3 z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm font-mono text-[10px] uppercase tracking-wider select-none pointer-events-none ${config.cls}`}
        >
          {config.icon}
          <span>{config.label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
