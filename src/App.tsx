/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Day, Task, Settings, AppView } from "./types";
import { getSettings, saveSettings, getDay, saveDay, getAllDays } from "./db";
import { DEFAULT_SETTINGS } from "./db";
import Navbar from "./components/Navbar";
import PostItCard from "./components/PostItCard";
import HistoryView from "./components/HistoryView";
import SettingsView from "./components/SettingsView";
import ProfileView from "./components/ProfileView";
import { getPaletteById } from "./constants/palettes";
import { Trash2, Plus, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { User } from "firebase/auth";
import {
  auth,
  initAuth,
  googleSignIn,
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
        };
        await saveDay(todayRecord);
      }

      setTodayDay(todayRecord);

      // Fetch past notes for history
      const allDays = await getAllDays();
      setAllDaysList(allDays);
    } catch (err) {
      console.error("Failed to load initial data from IndexedDB:", err);
    }
  };

  // Wrapper for saving days to IndexedDB + Background Sync to Cloud if logged in
  const saveDayWithSync = async (day: Day) => {
    // 1. Instant local persistence to IndexedDB
    await saveDay(day);

    // 2. Background sync to Supabase if authenticated
    if (auth.currentUser) {
      await syncDayToCloud(day);
    }
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

  // Setup Auth, cloud syncer, calendar expiry observer, and local data loading
  useEffect(() => {
    const unsub = initAuth(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // If logged in on a new device, drag cloud records down and merge
          await pullAllDaysFromCloud();
          // Flush any offline sync queue immediately
          await syncAllUnsyncedDays();
        } catch (e) {
          console.error("Background initial sync setup failed:", e);
        }
      }
      // Re-trigger visual layout load of active note items
      await loadInitialData();
    });

    // Calendar expiry observer
    const unsubExpired = subscribeCalendarExpired((expired) => {
      setCalendarExpired(expired);
    });

    return () => {
      unsub();
      unsubExpired();
    };
  }, []);

  // Fetch upcoming calendar schedule when connected
  useEffect(() => {
    let active = true;
    if (currentUser && isCalendarConnected()) {
      fetchGoogleCalendarEvents()
        .then((events) => {
          if (active) setCalendarEvents(events);
        })
        .catch((err) => console.error("Could not sync Google Calendar events:", err));
    } else {
      setCalendarEvents([]);
    }
    return () => {
      active = false;
    };
  }, [currentUser, currentView, todayDay, calendarExpired]);

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

    const updatedDay = {
      ...todayDay,
      tasks: updatedTasks,
    };

    setTodayDay(updatedDay);
    await saveDayWithSync(updatedDay);

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

  // Inline typing change listener (updates react state and local IndexedDB instantly)
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

    const updatedDay = {
      ...todayDay,
      tasks: updatedTasks,
    };

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
      <Navbar currentView={currentView} onViewChange={setCurrentView} currentUserPhoto={currentUser?.photoURL} />

      {/* Expiry Warning Alert Banner */}
      {calendarExpired && (
        <div 
          id="calendar-expired-warn-banner"
          className="mx-auto my-3 w-full max-w-md bg-amber-50 border border-amber-200/80 text-amber-900 text-xs py-2 px-3.5 rounded-xl flex items-center justify-between gap-3 shadow-sm z-50 select-none animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="leading-tight font-medium">Your calendar connection expired. Login again to rebuild your tasks.</span>
          </div>
          <button
            onClick={() => {
              googleSignIn()
                .then(() => setCalendarExpired(false))
                .catch(err => console.error("Error signing in from expired banner popup:", err));
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[9px] uppercase font-bold py-1 px-2.5 rounded shadow-sm transition-colors shrink-0"
          >
            Reconnect
          </button>
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
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
