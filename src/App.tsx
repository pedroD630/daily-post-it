/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Day, Task, Settings, AppView, ThemeMode, Goal } from "./types";
import { getSettings, saveSettings, getDay, saveDay, getAllDays, getBalance, getBalanceMeta, applyPointsDelta, setBalance, getAllGoals, saveGoal, deleteGoalLocal, getAllCheckpoints, saveCheckpoint, deleteCheckpointLocal, getAllHabits, saveHabit } from "./db";
import { DEFAULT_SETTINGS } from "./db";
import Navbar from "./components/Navbar";
import PostItCard from "./components/PostItCard";
import PenColorPicker from "./components/PenColorPicker";
import HistoryView from "./components/HistoryView";
import SettingsView from "./components/SettingsView";
import ProfileView from "./components/ProfileView";
import ShopView from "./components/ShopView";
import InsightsView from "./components/InsightsView";
import CommandPalette from "./components/CommandPalette";
import GoalsView from "./components/GoalsView";
import { getPaletteById } from "./constants/palettes";
import { pointValue, computeTaskPoints } from "./utils/points";
import { computeStreak } from "./utils/insights";
import { startPenaltyScheduler, checkMissedPenalty } from "./utils/penaltyScheduler";
import { syncPointsBalanceToSupabase, pullPointsBalanceFromSupabase, syncGoalToSupabase, deleteGoalFromSupabase, pullAllGoalsFromSupabase, syncCheckpointToSupabase, pullAllCheckpointsFromSupabase, syncHabitToSupabase, pullAllHabitsFromSupabase } from "./db/supabase";
import { Checkpoint, Habit } from "./types";
import { ParsedCheckpoint } from "./utils/checkpointParser";
import StreakView from "./components/StreakView";
import SyncIndicator, { SyncState } from "./components/SyncIndicator";
import ConfirmSheet from "./components/ConfirmSheet";
import { Reward } from "./constants/rewards";
import { Trash2, Plus, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { User } from "firebase/auth";
import {
  auth,
  initAuth,
  googleSignIn,
  reconnectGoogleCalendar,
  syncDayToCloud,
  pullAllDaysFromCloud,
  fetchGoogleCalendarEvents,
  isCalendarConnected,
  syncAllUnsyncedDays,
  subscribeCalendarExpired
} from "./db/firebase";
import {
  createGoogleTask,
  updateGoogleTask,
  deleteGoogleTask,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent
} from "./db/googleSync";

// Tag a day with a fresh updatedAt timestamp. EVERY local mutation must
// route through this before being persisted — pullAllDaysFromCloud uses
// the timestamp to skip overwriting locally-fresh state with a stale
// cloud snapshot (e.g. while the user is typing).
function touch<T extends { updatedAt?: number }>(day: T): T {
  return { ...day, updatedAt: Date.now() };
}

// Helper to convert hex to beautiful low-opacity background value
function hexToRgba(hex: string, opacity: number): string {
  let cleanHex = hex.replace(/^#/, "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((x) => x + x).join("");
  }
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(254, 243, 199, ${opacity})`; // fallback yellow
  }
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Local date helpers based on user timezone
const getTodayId = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayDisplayDate = () => {
  const d = new Date();
  const year = String(d.getFullYear()).slice(-2);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
};

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("main");
  
  // App settings & current active note state
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [livePostItColor, setLivePostItColor] = useState<string>(DEFAULT_SETTINGS.postItColor);
  const [todayDay, setTodayDay] = useState<Day | null>(null);
  
  // Entire DB records parsed for history view
  const [allDaysList, setAllDaysList] = useState<Day[]>([]);
  
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  
  // State to trigger the crumpling physical animation
  const [isCrumpling, setIsCrumpling] = useState(false);

  // Auth and Google Calendar States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarExpired, setCalendarExpired] = useState(false);
  const [reconnectError, setReconnectError] = useState(false);
  // Service worker "update available" prompt (replaces window.confirm in main.tsx)
  const [pendingWorker, setPendingWorker] = useState<ServiceWorker | null>(null);

  // Points & Rewards
  const [pointsBalance, setPointsBalance] = useState<number>(0);

  // Long-term goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);

  // Command palette + cross-view navigation helpers
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyFocusDayId, setHistoryFocusDayId] = useState<string | null>(null);
  // Always-fresh ref of today's tasks for the penalty scheduler (which runs
  // on a setInterval and would otherwise capture a stale closure).
  const todayDayRef = useRef<Day | null>(null);
  useEffect(() => {
    todayDayRef.current = todayDay;
  }, [todayDay]);

  /**
   * Adjust the balance: writes to IDB, updates state, and (if logged in)
   * mirrors the new value to Supabase. Returns the new balance.
   */
  const adjustBalance = async (delta: number): Promise<number> => {
    const next = await applyPointsDelta(delta);
    setPointsBalance(next);
    if (auth.currentUser) {
      // Fire-and-forget; the IDB write is the source of truth.
      void syncPointsBalanceToSupabase(auth.currentUser.uid, next);
    }
    return next;
  };

  // ---------------------------------------------------------------
  // Theme: apply/remove the `dark` class on <html> from settings,
  // following the OS preference live when in "system" mode.
  // ---------------------------------------------------------------
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && mql.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [settings.theme]);

  // Liquid Glass: toggle the root class that intensifies frosted surfaces.
  useEffect(() => {
    document.documentElement.classList.toggle("liquid-glass", !!settings.liquidGlass);
  }, [settings.liquidGlass]);

  // Service worker update prompt — surfaced as a styled sheet instead of the
  // native window.confirm that main.tsx used to fire.
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const worker = (e as CustomEvent).detail as ServiceWorker | undefined;
      if (worker) setPendingWorker(worker);
    };
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  // Global keyboard shortcut: Ctrl/Cmd+K toggles the command palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // A palette jump pins history to a day; release the pin on leaving the view
  useEffect(() => {
    if (currentView !== "history" && historyFocusDayId) {
      setHistoryFocusDayId(null);
    }
  }, [currentView, historyFocusDayId]);

  // Unified list of days: history + today, deduplicated. Memoized once and
  // reused for streak, derived points and Insights so we don't rebuild it
  // on every render.
  const allDays = useMemo(() => (
    todayDay ? [...allDaysList.filter((d) => d.id !== todayDay.id), todayDay] : allDaysList
  ), [allDaysList, todayDay]);

  // Current productivity streak (recomputed when any day changes)
  const streak = useMemo(() => computeStreak(allDays), [allDays]);

  // Points derived from completed tasks — the source of truth for task
  // contributions. Synced cross-device for free via the days/tasks tables,
  // so it can never get into the lost-update race that hit the old ledger.
  const derivedTaskPoints = useMemo(() => computeTaskPoints(allDays), [allDays]);

  // What the user actually sees as their balance: task points (derived)
  // PLUS the ledger (which only carries penalties and redemptions in v2).
  // The legacy ledger value gets zeroed out on first boot by the migration.
  const displayBalance = derivedTaskPoints + pointsBalance;

  const loadInitialData = async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      setLivePostItColor(loadedSettings.postItColor);

      const todayId = getTodayId();
      let todayRecord = await getDay(todayId);

      if (!todayRecord) {
        todayRecord = {
          id: todayId,
          date: getTodayDisplayDate(),
          createdAt: Date.now(),
          discarded: false,
          discardedAt: null,
          style: {
            postItColor: loadedSettings.postItColor,
            paperTexture: loadedSettings.paperTexture,
          },
          tasks: [],
          // Intentionally NOT setting updatedAt here. This is a defensive
          // auto-create (the user hasn't touched today yet) so any cloud
          // copy of today — even one with cloud.updatedAt = 0 (e.g.
          // migration 004 hasn't been run) — should win the merge and
          // populate the shell with the real data from another device.
        };
        await saveDay(todayRecord);
      }

      setTodayDay(todayRecord);

      // Fetch past notes for history
      const allDays = await getAllDays();
      setAllDaysList(allDays);

      // Load current points balance from IndexedDB
      const balance = await getBalance();
      setPointsBalance(balance);

      // Load long-term goals
      const allGoals = await getAllGoals();
      setGoals(allGoals);

      const allCheckpoints = await getAllCheckpoints();
      // Tombstoned (soft-deleted) checkpoints stay in IDB for sync but never
      // show in the UI.
      setCheckpoints(allCheckpoints.filter((c) => !c.deleted));

      const allHabits = await getAllHabits();
      setHabits(allHabits.filter((h) => !h.deleted));
    } catch (err) {
      console.error("Failed to load initial data from IndexedDB:", err);
    }
  };

  // Wrapper for saving days to IndexedDB + Background Sync to Cloud if logged in.
  // Touches updatedAt so the cloud-merge logic knows this is the freshest copy.
  const saveDayWithSync = async (day: Day): Promise<Day> => {
    const stamped = touch(day);
    await saveDay(stamped);
    if (auth.currentUser) {
      await syncDayToCloud(stamped);
    }
    return stamped;
  };

  const handleRefreshData = async () => {
    if (auth.currentUser) {
      try {
        await pullAllDaysFromCloud();
      } catch (err) {
        console.error("Cloud pull failed under profile reload:", err);
      }
    }
    await loadInitialData();
  };

  // One-shot ledger migration to v2 semantics. In v1, the points_ledger
  // stored the running grand total (task completions + penalties +
  // redemptions). In v2, task completions are derived from the days table
  // and the ledger only carries non-task adjustments. To transition without
  // permanently double-counting, every device runs this once.
  //
  // Cross-device coordination uses the user_points.format_version column:
  // when cloud is already v1, this device just adopts the cloud value and
  // marks the local flag. When cloud is v0 (or absent), this device zeros
  // the ledger out and pushes — that push promotes the cloud row to v1,
  // so any later device sees v1 and skips re-migrating.
  const migratePointsLedgerOnce = async (uid: string | null) => {
    const FLAG = "points_ledger_migrated_v2";
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(FLAG)) return;

    try {
      if (uid && navigator.onLine) {
        const cloud = await pullPointsBalanceFromSupabase(uid);
        if (cloud && cloud.formatVersion >= 1) {
          // Another device already migrated; adopt cloud and bail.
          await setBalance(cloud.balance);
          setPointsBalance(cloud.balance);
          localStorage.setItem(FLAG, "1");
          return;
        }
      }
      // Zero out the ledger: task points come from the derived computation
      // going forward. The transient effect is that legacy penalty /
      // redemption history is reset — acceptable given the alternative was
      // a permanently wrong cross-device balance.
      await setBalance(0);
      setPointsBalance(0);
      if (uid && navigator.onLine) {
        await syncPointsBalanceToSupabase(uid, 0);
      }
      localStorage.setItem(FLAG, "1");
    } catch (e) {
      console.error("Points ledger v2 migration failed:", e);
    }
  };

  // Refresh-from-cloud is the single sync entry point used on auth,
  // visibility change, online event, and the periodic timer. The order
  // matters and is *deliberate*:
  //   1. Push the offline queue first so the cloud reflects every local
  //      mutation that might have been interrupted (auto-reconnect
  //      redirect, mobile background-kill, network blip). syncDayToCloud
  //      queues each day BEFORE the network call, so nothing in flight
  //      is lost — even reload mid-await re-pushes on next refresh.
  //   2. Pull days from the cloud. Now the cloud is canonical and pulling
  //      cannot clobber un-synced local work.
  //   3. Merge the points balance by timestamp (last-write-wins). Cloud
  //      only overwrites local if its updated_at is fresher; otherwise
  //      we push the local value back up. This is what enables
  //      cross-device sync without losing offline points adjustments.
  //   4. Re-read everything from IDB into React state.
  const isRefreshingRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const [syncState, setSyncState] = useState<SyncState>("idle");

  const refreshFromCloud = async (uid: string, opts: { force?: boolean } = {}) => {
    if (isRefreshingRef.current) return;
    if (!opts.force && Date.now() - lastRefreshAtRef.current < 5_000) return; // throttle
    isRefreshingRef.current = true;
    if (!navigator.onLine) {
      setSyncState("offline");
    } else {
      setSyncState("syncing");
    }
    try {
      if (navigator.onLine) {
        try {
          await syncAllUnsyncedDays();
        } catch (e) {
          console.warn("Pre-pull queue flush failed:", e);
        }
        try {
          await pullAllDaysFromCloud();
        } catch (e) {
          console.warn("Cloud days pull failed:", e);
        }
        try {
          const cloud = await pullPointsBalanceFromSupabase(uid);
          if (cloud) {
            const local = await getBalanceMeta();
            if (cloud.updatedAt > local.lastUpdated) {
              await setBalance(cloud.balance);
              setPointsBalance(cloud.balance);
            } else if (local.lastUpdated > cloud.updatedAt) {
              void syncPointsBalanceToSupabase(uid, local.balance);
            }
          }
        } catch (e) {
          console.warn("Points balance merge failed:", e);
        }
        try {
          // Pull goals — same last-write-wins by updatedAt
          const cloudGoals = await pullAllGoalsFromSupabase(uid);
          for (const cloudGoal of cloudGoals) {
            const localGoals = await getAllGoals();
            const localGoal = localGoals.find((g) => g.id === cloudGoal.id);
            const localUpdated = localGoal?.updatedAt ?? 0;
            const cloudUpdated = cloudGoal.updatedAt ?? 0;
            if (cloudUpdated >= localUpdated) {
              await saveGoal(cloudGoal);
            }
          }
        } catch (e) {
          console.warn("Goals pull/merge failed:", e);
        }
        try {
          // Bidirectional checkpoint merge so AI-created milestones reliably
          // sync across devices, even if the original push was interrupted
          // (offline, request failure). Last-write-wins by updatedAt:
          //   - cloud newer-or-equal & different  -> write cloud to local
          //   - local newer OR missing in cloud    -> push local to cloud
          const cloudCps = await pullAllCheckpointsFromSupabase(uid);
          const localCps = await getAllCheckpoints();
          const cloudById = new Map(cloudCps.map((c) => [c.id, c]));
          const localById = new Map(localCps.map((c) => [c.id, c]));

          // Cloud -> local
          for (const cloudCp of cloudCps) {
            const localCp = localById.get(cloudCp.id);
            if ((cloudCp.updatedAt ?? 0) >= (localCp?.updatedAt ?? 0)) {
              await saveCheckpoint(cloudCp);
            }
          }
          // Local -> cloud (re-push anything cloud is missing or has staler)
          for (const localCp of localCps) {
            const cloudCp = cloudById.get(localCp.id);
            if (!cloudCp || (localCp.updatedAt ?? 0) > (cloudCp.updatedAt ?? 0)) {
              void syncCheckpointToSupabase(localCp, uid);
            }
          }
        } catch (e) {
          console.warn("Checkpoints pull/merge failed:", e);
        }
        try {
          // Bidirectional habit merge (same pattern as checkpoints).
          const cloudHabits = await pullAllHabitsFromSupabase(uid);
          const localHabits = await getAllHabits();
          const cloudHById = new Map(cloudHabits.map((h) => [h.id, h]));
          const localHById = new Map(localHabits.map((h) => [h.id, h]));
          for (const cloudH of cloudHabits) {
            const localH = localHById.get(cloudH.id);
            if ((cloudH.updatedAt ?? 0) >= (localH?.updatedAt ?? 0)) {
              await saveHabit(cloudH);
            }
          }
          for (const localH of localHabits) {
            const cloudH = cloudHById.get(localH.id);
            if (!cloudH || (localH.updatedAt ?? 0) > (cloudH.updatedAt ?? 0)) {
              void syncHabitToSupabase(localH, uid);
            }
          }
        } catch (e) {
          console.warn("Habits pull/merge failed:", e);
        }
      }
      await loadInitialData();
      lastRefreshAtRef.current = Date.now();
      setSyncState(navigator.onLine ? "synced" : "offline");
    } catch {
      setSyncState(navigator.onLine ? "idle" : "offline");
    } finally {
      isRefreshingRef.current = false;
    }
  };

  // Keep refreshFromCloud reachable from non-effect callbacks (visibility,
  // focus, online) without re-binding on every render.
  const refreshFromCloudRef = useRef(refreshFromCloud);
  refreshFromCloudRef.current = refreshFromCloud;

  // Setup Auth, cloud syncer, calendar expiry observer, and local data loading
  useEffect(() => {
    // Stale flag from a previous version that gated cloud pulls — now removed
    // because it broke cross-device sync (mobile never pulled desktop's
    // writes). Safe to delete on every boot; no-op if absent.
    try { localStorage.removeItem("postit_last_pulled_uid"); } catch {}

    const unsub = initAuth(async (user) => {
      setCurrentUser(user);
      // Migration must run BEFORE refreshFromCloud so the zero-out doesn't
      // race against a cloud pull bringing back a legacy non-zero value.
      await migratePointsLedgerOnce(user?.uid ?? null);
      if (user) {
        await refreshFromCloudRef.current(user.uid, { force: true });
      } else {
        await loadInitialData();
      }
    });

    // Calendar expiry observer
    const unsubExpired = subscribeCalendarExpired((expired) => {
      setCalendarExpired(expired);
    });

    // Midnight penalty scheduler — checks every minute, applies once per day.
    const stopPenaltyScheduler = startPenaltyScheduler({
      getTodayTasks: () => todayDayRef.current?.tasks ?? [],
      onPenalty: async (delta) => {
        await adjustBalance(delta);
      },
    });

    // One-shot missed-penalty recovery on mount only.
    void checkMissedPenalty(
      async (id) => {
        const d = await getDay(id);
        return d ? { tasks: d.tasks } : null;
      },
      async (delta) => {
        await adjustBalance(delta);
      },
    );

    // Cross-device sync triggers — refresh when the tab regains focus
    // (typical mobile pattern: open the app on the phone and immediately
    // see what the desktop just synced) or when the network comes back.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const user = auth.currentUser;
      if (!user) return;
      void refreshFromCloudRef.current(user.uid);
    };
    const onOnline = () => {
      const user = auth.currentUser;
      if (!user) return;
      void refreshFromCloudRef.current(user.uid, { force: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onOnline);

    // Background heartbeat: while the tab is visible, refresh every 60s so
    // an idle tab doesn't drift from cloud state for very long.
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const user = auth.currentUser;
      if (!user) return;
      void refreshFromCloudRef.current(user.uid);
    }, 60_000);

    return () => {
      unsub();
      unsubExpired();
      stopPenaltyScheduler();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onOnline);
      window.clearInterval(heartbeat);
    };
  }, []);

  // Fetch upcoming Google Calendar events at boot and every 15 minutes while
  // the tab is open. NOT re-triggered by view changes or edits — those used
  // to fire a fresh request on every re-render, which turned a single 401
  // into a firehose of failing calls (and, previously, of reconnect redirects
  // that reloaded the whole app). The 15-minute cadence is fine because
  // "today's events" doesn't change second-by-second.
  useEffect(() => {
    if (!currentUser || !isCalendarConnected() || calendarExpired) {
      setCalendarEvents([]);
      return;
    }
    let active = true;
    const run = () => {
      fetchGoogleCalendarEvents()
        .then((events) => { if (active) setCalendarEvents(events); })
        .catch((err) => console.error("Could not sync Google Calendar events:", err));
    };
    run();
    const id = window.setInterval(run, 15 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [currentUser, calendarExpired]);

  // Sync back live visual post-it color to applet default background
  useEffect(() => {
    let color = settings.postItColor;
    if (currentView === "settings") {
      color = livePostItColor;
    } else if (todayDay) {
      color = todayDay.style.postItColor;
    }
    const tint = hexToRgba(color, 0.12);
    document.body.style.background = `linear-gradient(${tint}, ${tint}), #fcf6e8`;
  }, [livePostItColor, todayDay, settings.postItColor, currentView]);

  // Cancel any active task deletion mode if user clicks away
  const handlePageClick = () => {
    if (activeDeleteId) {
      setActiveDeleteId(null);
    }
  };

  // Add Task to today's list directly inline
  const handleAddTask = async () => {
    if (!todayDay) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      text: "",
      completed: false,
      completedAt: null,
      createdAt: Date.now(),
      order: todayDay.tasks.length,
      style: {
        penColor: settings.penColor,
        fontFamily: settings.fontFamily,
      },
    };

    const updatedDay = {
      ...todayDay,
      tasks: [...todayDay.tasks, newTask],
    };

    setTodayDay(updatedDay);
    await saveDayWithSync(updatedDay);
    
    // Refresh history days references securely
    const refreshedDays = await getAllDays();
    setAllDaysList(refreshedDays);
  };

  // Toggle tasks completion inline + sync to Google
  const handleToggleComplete = async (taskId: string) => {
    if (!todayDay) return;

    let targetTaskId: string | undefined;
    let targetEventId: string | undefined;

    const updatedTasks = todayDay.tasks.map((task) => {
      if (task.id === taskId) {
        const nextCompleted = !task.completed;
        targetTaskId = task.calendarTaskId;
        targetEventId = task.calendarEventId;
        return {
          ...task,
          completed: nextCompleted,
          completedAt: nextCompleted ? Date.now() : null,
        };
      }
      return task;
    });

    const updatedDay = touch({
      ...todayDay,
      tasks: updatedTasks,
    });

    setTodayDay(updatedDay);

    // CRITICAL ORDER: persist BOTH local writes (day + points) before any
    // network call. If an auto-reconnect redirect happens during a slow
    // network sync, our local state is already consistent — no scenario
    // where the day shows completed but points were never awarded (or
    // vice-versa).
    await saveDay(updatedDay);
    // No adjustBalance here in v2: the +N/-N for task completion is derived
    // from the days table via computeTaskPoints, so it's cross-device safe
    // without a separate ledger write. The floating "+10" animation in
    // TaskItem still fires from the click handler — it doesn't depend on
    // the ledger.

    // Now safely fire cloud syncs (background, queue-aware via syncDayToCloud).
    if (auth.currentUser) {
      syncDayToCloud(updatedDay).catch((err) =>
        console.error(`Background day sync failed for ${updatedDay.id}:`, err)
      );
    }

    // Sync state modification to Google right away if connected
    if (currentUser && isCalendarConnected()) {
      const taskObj = updatedDay.tasks.find((t) => t.id === taskId);
      if (taskObj) {
        try {
          if (targetEventId) {
            await updateGoogleEvent(targetEventId, todayDay.id, taskObj.text, taskObj.time || "", taskObj.reminderMinutes || 10, taskObj.completed);
          } else if (targetTaskId) {
            await updateGoogleTask(targetTaskId, taskObj.text, taskObj.completed);
          }
        } catch (err) {
          console.error("Google completed checkbox toggling failed:", err);
        }
      }
    }

    const refreshedDays = await getAllDays();
    setAllDaysList(refreshedDays);
  };

  // Inline typing change listener (updates react state and local IndexedDB instantly).
  // CRITICAL: touch() bumps updatedAt so refreshFromCloud running mid-typing
  // sees local as fresher and won't clobber the IDB with the pre-blur snapshot.
  const handleTextChange = async (taskId: string, text: string) => {
    if (!todayDay) return;

    const updatedTasks = todayDay.tasks.map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          text,
        };
      }
      return task;
    });

    const updatedDay = touch({
      ...todayDay,
      tasks: updatedTasks,
    });

    setTodayDay(updatedDay);
    await saveDay(updatedDay); // save locally fast, don't trigger online write until typing finished (blur/enter)
  };

  // Finalized text changes listener (fires on blur/enter to sync to Google and Supabase)
  const handleTextChangeFinished = async (taskId: string, text: string) => {
    if (!todayDay) return;

    const task = todayDay.tasks.find((t) => t.id === taskId);
    if (!task) return;

    let calendarTaskId = task.calendarTaskId;
    let calendarEventId = task.calendarEventId;

    if (currentUser && isCalendarConnected() && text.trim().length > 0) {
      try {
        if (task.time) {
          if (calendarEventId) {
            await updateGoogleEvent(calendarEventId, todayDay.id, text, task.time, task.reminderMinutes || 10, task.completed);
          } else {
            const newEvtId = await createGoogleEvent(todayDay.id, text, task.time, task.reminderMinutes || 10);
            if (newEvtId) {
              calendarEventId = newEvtId;
            }
          }
        } else {
          if (calendarTaskId) {
            await updateGoogleTask(calendarTaskId, text, task.completed);
          } else {
            const newTaskId = await createGoogleTask(text);
            if (newTaskId) {
              calendarTaskId = newTaskId;
            }
          }
        }
      } catch (err) {
        console.error("Google Text typing finalized sync error:", err);
      }
    }

    const updatedTasks = todayDay.tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          text,
          calendarTaskId,
          calendarEventId,
        };
      }
      return t;
    });

    const updatedDay = {
      ...todayDay,
      tasks: updatedTasks,
    };

    setTodayDay(updatedDay);
    await saveDayWithSync(updatedDay);

    const refreshedDays = await getAllDays();
    setAllDaysList(refreshedDays);
  };

  // Handle inline alarm click edits & schedule promotion (upgress/downgress)
  const handleTimeChange = async (taskId: string, time: string | undefined, reminderMinutes: number) => {
    if (!todayDay) return;

    const task = todayDay.tasks.find((t) => t.id === taskId);
    if (!task) return;

    let calendarTaskId = task.calendarTaskId;
    let calendarEventId = task.calendarEventId;

    if (currentUser && isCalendarConnected()) {
      try {
        if (time) {
          // Upgrading task -> event: delete Google Task if one existed
          if (calendarTaskId) {
            await deleteGoogleTask(calendarTaskId);
            calendarTaskId = undefined;
          }

          if (calendarEventId) {
            // Already an event, modify its details
            await updateGoogleEvent(calendarEventId, todayDay.id, task.text, time, reminderMinutes, task.completed);
          } else {
            // Instantiate brand new Event
            const newEvtId = await createGoogleEvent(todayDay.id, task.text, time, reminderMinutes);
            if (newEvtId) {
              calendarEventId = newEvtId;
            }
          }
        } else {
          // Downgrading event -> task: destroy Google Event if one existed
          if (calendarEventId) {
            await deleteGoogleEvent(calendarEventId);
            calendarEventId = undefined;
          }

          if (calendarTaskId) {
            // Already linked to standard task, update it
            await updateGoogleTask(calendarTaskId, task.text, task.completed);
          } else {
            // Instantiate brand new Tasks item
            const newTaskId = await createGoogleTask(task.text);
            if (newTaskId) {
              calendarTaskId = newTaskId;
            }
          }
        }
      } catch (err) {
        console.error("Google Time Picker sync failing:", err);
      }
    }

    const updatedTasks = todayDay.tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          time,
          reminderMinutes,
          calendarTaskId,
          calendarEventId,
        };
      }
      return t;
    });

    const updatedDay = {
      ...todayDay,
      tasks: updatedTasks,
    };

    setTodayDay(updatedDay);
    await saveDayWithSync(updatedDay);

    const refreshedDays = await getAllDays();
    setAllDaysList(refreshedDays);
  };

  // Deletion confirmed
  const handleDeleteTask = async (taskId: string) => {
    if (!todayDay) return;

    const taskToDelete = todayDay.tasks.find((t) => t.id === taskId);

    const updatedTasks = todayDay.tasks.filter((task) => task.id !== taskId);
    const updatedDay = {
      ...todayDay,
      tasks: updatedTasks,
    };

    setTodayDay(updatedDay);
    await saveDayWithSync(updatedDay);
    setActiveDeleteId(null);

    // Sync deletion directly to Google
    if (currentUser && isCalendarConnected() && taskToDelete) {
      try {
        if (taskToDelete.calendarEventId) {
          await deleteGoogleEvent(taskToDelete.calendarEventId);
        } else if (taskToDelete.calendarTaskId) {
          await deleteGoogleTask(taskToDelete.calendarTaskId);
        }
      } catch (err) {
        console.error("Google Delete synchronization failed:", err);
      }
    }

    const refreshedDays = await getAllDays();
    setAllDaysList(refreshedDays);
  };

  // Reorder tasks
  const handleReorderTasks = async (updatedTasks: Task[]) => {
    if (!todayDay) return;

    const updatedDay = {
      ...todayDay,
      tasks: updatedTasks,
    };

    setTodayDay(updatedDay);
    await saveDayWithSync(updatedDay);
  };

  // Day-note scratchpad commit (fires on textarea blur)
  const handleNoteChange = async (note: string) => {
    if (!todayDay) return;
    const updatedDay = { ...todayDay, note: note.trim() ? note : undefined };
    setTodayDay(updatedDay);
    await saveDayWithSync(updatedDay);
  };

  // --- Goals handlers ----------------------------------------------------
  const handleSaveGoal = async (goal: Goal) => {
    const stamped: Goal = { ...goal, updatedAt: Date.now() };
    setGoals((prev) => {
      const idx = prev.findIndex((g) => g.id === stamped.id);
      if (idx === -1) return [...prev, stamped];
      const next = prev.slice();
      next[idx] = stamped;
      return next;
    });
    await saveGoal(stamped);
    if (auth.currentUser) {
      void syncGoalToSupabase(stamped, auth.currentUser.uid);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await deleteGoalLocal(id);
    if (auth.currentUser) {
      void deleteGoalFromSupabase(id, auth.currentUser.uid);
    }
  };

  const handleArchiveGoal = async (id: string, archived: boolean) => {
    const existing = goals.find((g) => g.id === id);
    if (!existing) return;
    const updated: Goal = { ...existing, archived, updatedAt: Date.now() };
    setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    await saveGoal(updated);
    if (auth.currentUser) {
      void syncGoalToSupabase(updated, auth.currentUser.uid);
    }
  };

  // --- Checkpoints handlers ----------------------------------------------
  const persistCheckpoint = async (cp: Checkpoint) => {
    setCheckpoints((prev) => {
      const idx = prev.findIndex((c) => c.id === cp.id);
      if (idx === -1) return [...prev, cp];
      const next = prev.slice();
      next[idx] = cp;
      return next;
    });
    await saveCheckpoint(cp);
    if (auth.currentUser) {
      void syncCheckpointToSupabase(cp, auth.currentUser.uid);
    }
  };

  // Accept an AI-proposed checkpoint. Resolve the goal by title (exact match
  // first, then case-insensitive contains). Silently ignore if no goal matches.
  const handleAddCheckpoint = async (parsed: ParsedCheckpoint) => {
    const active = goals.filter((g) => !g.archived);
    const norm = (s: string) => s.trim().toLowerCase();
    const target =
      active.find((g) => norm(g.title) === norm(parsed.goalTitle)) ||
      active.find((g) => norm(g.title).includes(norm(parsed.goalTitle)) || norm(parsed.goalTitle).includes(norm(g.title)));
    if (!target) {
      console.warn("No goal matched checkpoint suggestion:", parsed.goalTitle);
      return;
    }
    const orderBase = checkpoints.filter((c) => c.goalId === target.id).length;
    const cp: Checkpoint = {
      id: crypto.randomUUID(),
      goalId: target.id,
      title: parsed.title,
      description: parsed.description,
      achieved: false,
      achievedAt: null,
      createdAt: Date.now(),
      order: orderBase,
      source: "ai",
      updatedAt: Date.now(),
    };
    await persistCheckpoint(cp);
  };

  const handleToggleCheckpoint = async (cp: Checkpoint) => {
    const next: Checkpoint = {
      ...cp,
      achieved: !cp.achieved,
      achievedAt: !cp.achieved ? Date.now() : null,
      updatedAt: Date.now(),
    };
    await persistCheckpoint(next);
  };

  const handleDeleteCheckpoint = async (id: string) => {
    const existing = checkpoints.find((c) => c.id === id);
    setCheckpoints((prev) => prev.filter((c) => c.id !== id));
    if (existing) {
      // Soft delete: keep a tombstone (deleted=true) in IDB + cloud so the
      // deletion propagates to other devices and can't be resurrected by
      // the bidirectional merge's re-push.
      const tombstone: Checkpoint = { ...existing, deleted: true, updatedAt: Date.now() };
      await saveCheckpoint(tombstone);
      if (auth.currentUser) {
        void syncCheckpointToSupabase(tombstone, auth.currentUser.uid);
      }
    } else {
      await deleteCheckpointLocal(id);
    }
  };

  // --- Habits (streak tracker) handlers ----------------------------------
  const handleSaveHabit = async (habit: Habit) => {
    const stamped: Habit = { ...habit, updatedAt: Date.now() };
    setHabits((prev) => {
      const idx = prev.findIndex((h) => h.id === stamped.id);
      if (idx === -1) return [...prev, stamped];
      const next = prev.slice();
      next[idx] = stamped;
      return next;
    });
    await saveHabit(stamped);
    if (auth.currentUser) {
      void syncHabitToSupabase(stamped, auth.currentUser.uid);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    const existing = habits.find((h) => h.id === id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
    if (existing) {
      // Soft-delete tombstone so deletion propagates cross-device.
      const tombstone: Habit = { ...existing, deleted: true, updatedAt: Date.now() };
      await saveHabit(tombstone);
      if (auth.currentUser) {
        void syncHabitToSupabase(tombstone, auth.currentUser.uid);
      }
    }
  };

  // Quick mutations triggered from the command palette — persist immediately
  const applyQuickSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setLivePostItColor(next.postItColor);
    try {
      await saveSettings(next);
    } catch (err) {
      console.error("Quick settings change failed to persist:", err);
    }
  };

  // Jump from palette result to the day that owns it
  const handleJumpToDay = (dayId: string) => {
    if (todayDay && dayId === todayDay.id) {
      setCurrentView("main");
      return;
    }
    setHistoryFocusDayId(dayId);
    setCurrentView("history");
  };

  // Discarding/Crumpling the Post-it Note
  const handleCrumpleDiscard = async () => {
    if (!todayDay || isCrumpling) return;

    // Start physical fade / rotate shrink animation
    setIsCrumpling(true);

    // Deleting Google elements linked to today's active note tasks
    if (currentUser && isCalendarConnected()) {
      for (const t of todayDay.tasks) {
        try {
          if (t.calendarEventId) {
            await deleteGoogleEvent(t.calendarEventId);
          } else if (t.calendarTaskId) {
            await deleteGoogleTask(t.calendarTaskId);
          }
        } catch (e) {
          console.warn(`Could not clear Google Tasks/Events during crumpling for task ${t.id}`, e);
        }
      }
    }

    // Give time (600ms) for the physical crumple animation to terminate before archiving
    setTimeout(async () => {
      try {
        const todayId = getTodayId();
        
        // Prepare today's card snapshot marked as discarded with a unique ID
        const discardedDay: Day = {
          ...todayDay,
          id: `${todayId}_discarded_${Date.now()}`,
          discarded: true,
          discardedAt: Date.now(),
        };

        // Persist archived version in IndexedDB
        await saveDayWithSync(discardedDay);

        // Generate a new fresh blank post-it
        const brandNewDay: Day = {
          id: todayId,
          date: getTodayDisplayDate(),
          createdAt: Date.now(),
          discarded: false,
          discardedAt: null,
          style: {
            postItColor: settings.postItColor,
            paperTexture: settings.paperTexture,
          },
          tasks: [],
        };

        // Overwrite the active record in IndexedDB for today
        await saveDayWithSync(brandNewDay);
        
        // Update states
        setTodayDay(brandNewDay);
        setIsCrumpling(false);
        
        // Refresh past days arrays
        const refreshedDays = await getAllDays();
        setAllDaysList(refreshedDays);
      } catch (err) {
        console.error("Failed to process paper crumpling:", err);
        setIsCrumpling(false);
      }
    }, 600);
  };

  // Saving Appearance parameters
  const handleSaveSettings = async (newSettings: Settings) => {
    try {
      await saveSettings(newSettings);
      setSettings(newSettings);
      setLivePostItColor(newSettings.postItColor);

      // Sync color & texture live on the active post-it if changed via settings.
      // Today is still being edited, so it follows the latest preference.
      // Historical days are untouched (their snapshot stays stable).
      if (todayDay) {
        const updatedDay = {
          ...todayDay,
          style: {
            postItColor: newSettings.postItColor,
            paperTexture: newSettings.paperTexture,
          },
        };
        setTodayDay(updatedDay);
        await saveDayWithSync(updatedDay);
      }

      const refreshedDays = await getAllDays();
      setAllDaysList(refreshedDays);

      // Return to main view
      setCurrentView("main");
    } catch (err) {
      console.error("Failed to commit settings changes:", err);
    }
  };

  const handleCancelSettings = () => {
    setLivePostItColor(settings.postItColor);
    setCurrentView("main");
  };

  // Filter history: Previous days notes only (today card excluded). Also omit empty days unless discarded
  const historyDays = allDaysList
    .filter((day) => day.id !== getTodayId())
    .filter((day) => day.tasks.length > 0 || day.discarded)
    .sort((a, b) => b.id.localeCompare(a.id));

  // Determine transition animations representing sliding paper sheets displacing
  const viewTransitionVariants = {
    initial: (current: AppView) => ({
      x: current === "history" ? -150 : 150,
      opacity: 0,
      rotate: current === "history" ? -6 : 6,
    }),
    animate: {
      x: 0,
      opacity: 1,
      rotate: 0,
      transition: {
        type: "spring",
        mass: 0.9,
        stiffness: 140,
        damping: 14,
      },
    },
    exit: (current: AppView) => ({
      x: current === "history" ? 150 : -150,
      opacity: 0,
      rotate: current === "history" ? 6 : -6,
      transition: {
        type: "tween",
        ease: "easeInOut",
        duration: 0.22,
      },
    }),
  };

  const activeBgColor = currentView === "settings" 
    ? livePostItColor 
    : (todayDay?.style.postItColor || settings.postItColor);

  return (
    <div
      id="applet-viewport-root"
      onClick={handlePageClick}
      className="min-h-screen w-full relative flex flex-col pt-20 pb-6 overflow-x-hidden"
      style={{
        '--page-bg': '#fcf6e8',
        backgroundColor: `${activeBgColor}26`,
        transition: "background-color 0.4s ease",
      } as React.CSSProperties}
    >
      {/* Ambient Glow Background */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none transition-all duration-500" 
        style={{ 
          background: `radial-gradient(circle at center, ${activeBgColor}  0%, transparent 70%)`, 
          opacity: 0.18 
        }} 
      />

      {/* Universal Fixed Top Navigation */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        currentUserPhoto={currentUser?.photoURL}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* Cloud sync status pill */}
      <SyncIndicator state={syncState} />

      {/* Service worker update prompt */}
      <ConfirmSheet
        open={pendingWorker !== null}
        title="Nova versão disponível"
        message="Uma atualização do Daily Post-it está pronta. Atualizar agora?"
        confirmLabel="Atualizar"
        cancelLabel="Depois"
        onConfirm={() => { pendingWorker?.postMessage("SKIP_WAITING"); setPendingWorker(null); }}
        onCancel={() => setPendingWorker(null)}
      />

      {/* Command Palette — Ctrl/Cmd+K or the navbar search button */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        days={todayDay ? [todayDay, ...allDaysList.filter((d) => d.id !== todayDay.id)] : allDaysList}
        todayId={getTodayId()}
        ctx={{
          setView: setCurrentView,
          newTask: handleAddTask,
          setTheme: (theme: ThemeMode) => void applyQuickSettings({ theme }),
          setColorPalette: (paletteId: string) => void applyQuickSettings({ paletteId }),
          togglePaperTexture: () => void applyQuickSettings({ paperTexture: !settings.paperTexture }),
          toggleLiquidGlass: () => void applyQuickSettings({ liquidGlass: !settings.liquidGlass }),
          jumpToDay: handleJumpToDay,
          forceSync: () => {
            const user = auth.currentUser;
            if (!user) return;
            void refreshFromCloudRef.current(user.uid, { force: true });
          },
        }}
      />

      {/* Calendar reconnect banner. Shown only when the last Google API call
          returned 401. The user's Firebase identity is intact — this only
          asks them to top up the short-lived Calendar access token. Uses
          the popup-first flow (no full-page reload). */}
      {calendarExpired && currentUser && (
        <div
          id="calendar-expired-warn-banner"
          className="mx-auto my-3 w-full max-w-md bg-amber-50 border border-amber-200/80 text-amber-900 text-xs py-2 px-3.5 rounded-xl flex items-center justify-between gap-3 shadow-sm z-50 select-none animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="leading-tight font-medium">
              Google Calendar sync paused. Reconnect to resume — the rest of the app keeps working.
            </span>
          </div>
          <button
            onClick={() => {
              setReconnectError(false);
              reconnectGoogleCalendar()
                .then((ok) => { if (ok) setCalendarExpired(false); })
                .catch((err) => {
                  console.error("Reconnect popup failed:", err);
                  setReconnectError(true);
                });
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[9px] uppercase font-bold py-1 px-2.5 rounded shadow-sm transition-colors shrink-0"
          >
            Reconnect
          </button>
        </div>
      )}
      {reconnectError && (
        <div className="mx-auto -mt-1 mb-2 w-full max-w-md text-[11px] text-amber-800 dark:text-amber-300 px-3.5 text-center">
          Popup bloqueado. Permita popups para este site e toque em Reconnect de novo.
        </div>
      )}

      {/* Screen viewports switcher with Animating Paper Sheet transitions */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex items-center justify-center p-4 z-10">
        <AnimatePresence mode="wait" custom={currentView}>
          <motion.div
            key={currentView}
            custom={currentView}
            variants={viewTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full flex justify-center"
            id={`view-transition-wrapper-${currentView}`}
          >
            {currentView === "main" && todayDay && (
              <div className="relative w-full max-w-md" id="main-view-viewbox">
                {/* Crumpling anim wrapper */}
                <motion.div
                  id="main-animated-postit-wrapper"
                  animate={
                    isCrumpling
                      ? {
                          scale: 0,
                          rotate: 720,
                          filter: "blur(8px)",
                          opacity: 0,
                        }
                      : {
                          scale: 1,
                          rotate: 0,
                          filter: "blur(0px)",
                          opacity: 1,
                        }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 14,
                  }}
                  className="w-full"
                >
                  <PostItCard
                    day={todayDay}
                    onToggleComplete={handleToggleComplete}
                    onTextChange={handleTextChange}
                    onTextChangeFinished={handleTextChangeFinished}
                    onTimeChange={handleTimeChange}
                    onDelete={handleDeleteTask}
                    onReorderTasks={handleReorderTasks}
                    readOnly={false}
                    activeDeleteId={activeDeleteId}
                    setActiveDeleteId={setActiveDeleteId}
                    calendarEvents={calendarEvents}
                    paperTexture={settings.paperTexture}
                    textureConfig={getPaletteById(settings.paletteId).texture}
                    pointsBalance={displayBalance}
                    onNoteChange={handleNoteChange}
                    streak={streak}
                    onOpenInsights={() => setCurrentView("insights")}
                  />
                </motion.div>

                {/* Trash/Crumple icon bottom-left */}
                <button
                  id="main-trash-icon-discard"
                  aria-label="Crumple and discard today's post-it note"
                  onClick={handleCrumpleDiscard}
                  disabled={isCrumpling}
                  className="absolute -bottom-16 left-2 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-500 bg-white/20 hover:bg-white/80 border border-transparent hover:border-slate-250 backdrop-blur-sm shadow-sm transition-all duration-300 opacity-30 hover:opacity-100 cursor-pointer z-50 pointer-events-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Crumple page</span>
                </button>

                {/* Inline pen-color picker (brush) — sits above the + FAB */}
                <PenColorPicker
                  value={settings.penColor}
                  onChange={(hex) => void applyQuickSettings({ penColor: hex })}
                />

                {/* Floating Action '+' Button right-bottom */}
                <button
                  id="main-fab-addtask"
                  aria-label="Create new task"
                  onClick={handleAddTask}
                  className="fixed bottom-6 right-6 flex items-center justify-center w-14 h-14 rounded-full text-white shadow-lg focus:outline-none transition-all duration-200 cursor-pointer active:scale-95 animate-fadeIn z-40"
                  style={{
                    backgroundColor: settings.penColor,
                    boxShadow: `0 4px 10px ${hexToRgba(settings.penColor, 0.4)}`,
                  }}
                >
                  <Plus className="w-7 h-7 stroke-[2.5]" />
                </button>
              </div>
            )}

            {currentView === "history" && (
              <HistoryView
                historyDays={historyDays}
                paperTexture={settings.paperTexture}
                textureConfig={getPaletteById(settings.paletteId).texture}
                focusDayId={historyFocusDayId}
              />
            )}

            {currentView === "insights" && (
              <InsightsView
                allDays={allDays}
                pointsBalance={displayBalance}
                goals={goals}
                geminiApiKey={settings.geminiApiKey}
                onAddCheckpoint={handleAddCheckpoint}
              />
            )}

            {currentView === "settings" && (
              <SettingsView
                initialSettings={settings}
                onSave={handleSaveSettings}
                onCancel={handleCancelSettings}
                onColorChangeLive={setLivePostItColor}
              />
            )}

            {currentView === "profile" && (
              <ProfileView
                historyDays={historyDays}
                todayDay={todayDay}
                currentUser={currentUser}
                onRefreshData={handleRefreshData}
                onViewChange={setCurrentView}
              />
            )}

            {currentView === "shop" && (
              <ShopView
                balance={displayBalance}
                onRedeem={async (reward: Reward) => {
                  await adjustBalance(-reward.cost);
                }}
              />
            )}

            {currentView === "goals" && (
              <GoalsView
                goals={goals}
                allDays={todayDay ? [...allDaysList.filter((d) => d.id !== todayDay.id), todayDay] : allDaysList}
                pointsBalance={displayBalance}
                geminiApiKey={settings.geminiApiKey}
                checkpoints={checkpoints}
                onSaveGoal={handleSaveGoal}
                onDeleteGoal={handleDeleteGoal}
                onArchiveGoal={handleArchiveGoal}
                onAddCheckpoint={handleAddCheckpoint}
                onToggleCheckpoint={handleToggleCheckpoint}
                onDeleteCheckpoint={handleDeleteCheckpoint}
              />
            )}

            {currentView === "streak" && (
              <StreakView
                habits={habits}
                onSaveHabit={handleSaveHabit}
                onDeleteHabit={handleDeleteHabit}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
