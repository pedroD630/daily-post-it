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
import { Trash2, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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

  // Load database files on initialization
  useEffect(() => {
    async function loadInitialData() {
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
    }
    loadInitialData();
  }, []);

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
    await saveDay(updatedDay);
    
    // Refresh history days references securely
    const refreshedDays = await getAllDays();
    setAllDaysList(refreshedDays);
  };

  // Toggle tasks completion inline
  const handleToggleComplete = async (taskId: string) => {
    if (!todayDay) return;

    const updatedTasks = todayDay.tasks.map((task) => {
      if (task.id === taskId) {
        const nextCompleted = !task.completed;
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
    await saveDay(updatedDay);

    const refreshedDays = await getAllDays();
    setAllDaysList(refreshedDays);
  };

  // Inline typing change listener
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
    await saveDay(updatedDay);
  };

  // Deletion confirmed
  const handleDeleteTask = async (taskId: string) => {
    if (!todayDay) return;

    const updatedTasks = todayDay.tasks.filter((task) => task.id !== taskId);
    const updatedDay = {
      ...todayDay,
      tasks: updatedTasks,
    };

    setTodayDay(updatedDay);
    await saveDay(updatedDay);
    setActiveDeleteId(null);

    const refreshedDays = await getAllDays();
    setAllDaysList(refreshedDays);
  };

  // Discarding/Crumpling the Post-it Note
  const handleCrumpleDiscard = async () => {
    if (!todayDay || isCrumpling) return;

    // Start physical fade / rotate shrink animation
    setIsCrumpling(true);

    // Give time (600ms) for the physical crumple animation to terminate before archiving
    setTimeout(async () => {
      try {
        const todayId = getTodayId();
        
        // Prepare today's card snapshot marked as discarded
        const discardedDay: Day = {
          ...todayDay,
          discarded: true,
          discardedAt: Date.now(),
        };

        // Persist archived version in IndexedDB
        await saveDay(discardedDay);

        // Generate a new fresh blank post-it
        const brandNewDay: Day = {
          id: todayId,
          date: getTodayDisplayDate(),
          createdAt: Date.now(),
          discarded: false,
          discardedAt: null,
          style: {
            postItColor: settings.postItColor,
          },
          tasks: [],
        };

        // Overwrite the active record in IndexedDB for today
        await saveDay(brandNewDay);
        
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

      // Sync color live on the active post-it background if color was edited
      if (todayDay) {
        const updatedDay = {
          ...todayDay,
          style: {
            postItColor: newSettings.postItColor,
          },
        };
        setTodayDay(updatedDay);
        await saveDay(updatedDay);
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

  // Filter history: Previous days notes only (today card excluded)
  const historyDays = allDaysList
    .filter((day) => day.id !== getTodayId())
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
          background: `radial-gradient(circle at center, ${activeBgColor} 0%, transparent 70%)`, 
          opacity: 0.18 
        }} 
      />

      {/* Universal Fixed Top Navigation */}
      <Navbar currentView={currentView} onViewChange={setCurrentView} />

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
                    onDelete={handleDeleteTask}
                    readOnly={false}
                    activeDeleteId={activeDeleteId}
                    setActiveDeleteId={setActiveDeleteId}
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
                  className="fixed bottom-6 right-6 flex items-center justify-center w-14 h-14 rounded-full text-white shadow-lg focus:outline-none transition-all duration-200 cursor-pointer active:scale-95"
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
              <HistoryView historyDays={historyDays} />
            )}

            {currentView === "settings" && (
              <SettingsView
                initialSettings={settings}
                onSave={handleSaveSettings}
                onCancel={handleCancelSettings}
                onColorChangeLive={setLivePostItColor}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>


    </div>
  );
}
