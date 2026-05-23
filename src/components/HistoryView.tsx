/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Day } from "../types";
import PostItCard from "./PostItCard";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";

interface HistoryViewProps {
  historyDays: Day[];
  paperTexture?: boolean;
}

export default function HistoryView({ historyDays, paperTexture = true }: HistoryViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right">("left");
  const [showHint, setShowHint] = useState(true);

  // Check if they already dismissed the swipe tutorial hint in this browser
  useEffect(() => {
    const hintDismissed = localStorage.getItem("postit_history_swiped");
    if (hintDismissed) {
      setShowHint(false);
    }
  }, []);

  if (historyDays.length === 0) {
    return (
      <div
        id="history-view-empty"
        className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[50vh] px-6 text-center select-none"
      >
        <p className="text-slate-400 text-lg italic" id="empty-history-text">
          "No past notes yet."
        </p>
        <p className="text-xs text-slate-400 mt-2 font-mono" id="empty-history-sub">
          Past days will appear here once archived or discarded.
        </p>
      </div>
    );
  }

  const currentDay = historyDays[currentIndex];

  const handleSwipeLeft = () => {
    // Swipe left (drag left) -> Go to older post-it (increment index)
    if (currentIndex < historyDays.length - 1) {
      setSwipeDirection("left");
      setCurrentIndex((prev) => prev + 1);
      dismissHint();
    }
  };

  const handleSwipeRight = () => {
    // Swipe right (drag right) -> Go to newer post-it (decrement index)
    if (currentIndex > 0) {
      setSwipeDirection("right");
      setCurrentIndex((prev) => prev - 1);
      dismissHint();
    }
  };

  const dismissHint = () => {
    setShowHint(false);
    localStorage.setItem("postit_history_swiped", "true");
  };

  // Determine transition coordinates for paper wind physics
  const variants = {
    initial: (dir: "left" | "right") => ({
      x: dir === "left" ? 300 : -300,
      y: 0,
      rotate: dir === "left" ? 15 : -15,
      opacity: 0,
    }),
    animate: {
      x: 0,
      y: 0,
      rotate: 0,
      opacity: 1,
      transition: {
        type: "spring",
        mass: 0.8,
        stiffness: 160,
        damping: 15,
      },
    },
    exit: (dir: "left" | "right") => ({
      x: dir === "left" ? -300 : 300,
      // Sheet of paper carried upwards by the wind
      y: -60,
      rotate: dir === "left" ? -12 : 12,
      opacity: 0,
      transition: {
        type: "tween",
        ease: "easeInOut",
        duration: 0.25,
      },
    }),
  };

  return (
    <div
      id="history-view-layout"
      className="w-full max-w-md mx-auto flex flex-col items-center justify-start py-8 px-4 select-none"
    >
      {/* Swipeable card container stack with wind physics */}
      <div className="relative w-full aspect-square flex items-center justify-center p-2 mb-6" id="history-card-relative-container">
        <AnimatePresence mode="popLayout" custom={swipeDirection}>
          <motion.div
            key={currentIndex}
            custom={swipeDirection}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(event, info) => {
              const swipedFarEnough = Math.abs(info.offset.x) > 60;
              const swipedFastEnough = Math.abs(info.velocity.x) > 300;

              if (swipedFarEnough || swipedFastEnough) {
                if (info.offset.x < 0 || info.velocity.x < 0) {
                  handleSwipeLeft();
                } else {
                  handleSwipeRight();
                }
              }
            }}
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
            id={`history-animated-card-container-${currentDay.id}`}
          >
            <PostItCard
              day={currentDay}
              readOnly={true}
              activeDeleteId={null}
              setActiveDeleteId={() => {}}
              paperTexture={paperTexture}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination Controls / Tappers (Accessibility support + clean click fallback) */}
      <div className="flex items-center justify-between w-full max-w-xs px-2 mb-4" id="history-pagination-tap-controls">
        <button
          id="history-btn-newer"
          aria-label="View newer notes"
          onClick={handleSwipeRight}
          disabled={currentIndex === 0}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
            currentIndex === 0
              ? "text-slate-300 pointer-events-none"
              : "bg-white text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 cursor-pointer"
          }`}
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Counter Display */}
        <span
          id="history-counter-digits"
          className="font-mono text-sm text-slate-500 font-semibold tracking-wider bg-slate-100 px-3 py-1.5 rounded-full shadow-inner"
        >
          {currentIndex + 1} of {historyDays.length}
        </span>

        <button
          id="history-btn-older"
          aria-label="View older notes"
          onClick={handleSwipeLeft}
          disabled={currentIndex === historyDays.length - 1}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
            currentIndex === historyDays.length - 1
              ? "text-slate-300 pointer-events-none"
              : "bg-white text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 cursor-pointer"
          }`}
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Swipe Navigation Tutorial Overlay Badge Hint */}
      {showHint && (
        <motion.div
          id="history-dismissible-hint"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center gap-2 bg-slate-800 text-slate-100 text-xs px-4 py-2.5 rounded-full shadow-md z-10 select-none pointer-events-none"
        >
          <Info className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>Swipe post-it left/right or use arrows to navigate history</span>
        </motion.div>
      )}
    </div>
  );
}
