/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { Task } from "../types";
import { motion } from "motion/react";

interface TaskItemProps {
  key?: React.Key | string;
  task: Task;
  onToggleComplete?: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
  isNew?: boolean;
  activeDeleteId: string | null;
  setActiveDeleteId: (id: string | null) => void;
}

export default function TaskItem({
  task,
  onToggleComplete = (id: string) => {},
  onTextChange = (id: string, text: string) => {},
  onDelete = (id: string) => {},
  readOnly = false,
  isNew = false,
  activeDeleteId,
  setActiveDeleteId
}: TaskItemProps) {
  const [inputValue, setInputValue] = useState(task.text);
  const [isTypewriterDone, setIsTypewriterDone] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDeleteMode = activeDeleteId === task.id;

  // Sync state if text changes on save or external update
  useEffect(() => {
    setInputValue(task.text);
  }, [task.text]);

  // Dynamic tallness adjust when text wraps or grows
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [inputValue]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  // Map snapshot fontFamily to class
  const getFontClass = (font: string) => {
    if (font === "serif") return "font-elegant";
    if (font === "cursive") return "font-handwritten text-lg leading-relaxed";
    return "font-default";
  };

  // Helper to handle text typing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    onTextChange(task.id, e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  // Long-press detection helpers
  const handlePressStart = (clientX: number, clientY: number) => {
    if (readOnly || isDeleteMode) return;

    // Record start coordinates to cancel if the user scrolls or drags
    pressStartPosRef.current = { x: clientX, y: clientY };

    pressTimerRef.current = setTimeout(() => {
      // Trigger Delete Mode
      setActiveDeleteId(task.id);
    }, 600);
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handlePressMove = (clientX: number, clientY: number) => {
    if (!pressStartPosRef.current) return;
    const dx = Math.abs(clientX - pressStartPosRef.current.x);
    const dy = Math.abs(clientY - pressStartPosRef.current.y);

    // Cancel long press if user moves more than 10px (likely scrolling)
    if (dx > 10 || dy > 10) {
      handlePressEnd();
    }
  };

  // Focus cleanup on focus loss
  const handleBlur = () => {
    handlePressEnd();
  };

  return (
    <motion.div
      id={`task-item-${task.id}`}
      layout
      transition={{ type: "spring", damping: 25, stiffness: 220 }}
      className={`relative group flex items-center py-2.5 px-3 -mx-2 rounded-lg transition-all duration-200 ${
        isDeleteMode
          ? "ring-2 ring-red-500/80 bg-red-50/20 shadow-sm animate-shake"
          : "hover:bg-black/[0.02]"
      } ${task.completed ? "opacity-40" : "opacity-100"}`}
      style={{
        contentVisibility: "auto"
      }}
      // Mouse listeners
      onMouseDown={(e) => handlePressStart(e.clientX, e.clientY)}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onMouseMove={(e) => handlePressMove(e.clientX, e.clientY)}
      // Touch listeners (mobile-first)
      onTouchStart={(e) => {
        const touch = e.touches[0];
        handlePressStart(touch.clientX, touch.clientY);
      }}
      onTouchEnd={handlePressEnd}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        handlePressMove(touch.clientX, touch.clientY);
      }}
    >
      {/* Checkbox (Aria compliant & custom styling) */}
      <button
        id={`task-checkbox-${task.id}`}
        disabled={readOnly}
        aria-label={task.completed ? "Mark task as incomplete" : "Mark task as complete"}
        onClick={(e) => {
          e.stopPropagation(); // Prevent long press trig
          onToggleComplete(task.id);
        }}
        className="flex items-center justify-center w-6 h-6 mr-3 border-2 rounded-sm bg-white/50 transition-all cursor-pointer focus:outline-none shrink-0"
        style={{
          borderColor: task.style.penColor,
          backgroundColor: task.completed ? task.style.penColor : "rgba(255, 255, 255, 0.5)",
        }}
      >
        {task.completed && (
          <Check
            className="w-4 h-4 text-white stroke-[3.5]"
            style={{ color: "#ffffff" }}
          />
        )}
      </button>

      {/* Editable input field with Typewriter effect */}
      <div className="flex-1 min-w-0" id={`task-text-container-${task.id}`}>
        {isNew && !isTypewriterDone ? (
          <div
            id={`task-typewriter-${task.id}`}
            className={`animate-typewriter border-r-2 h-6 flex items-center ${getFontClass(task.style.fontFamily)}`}
            style={{
              borderColor: task.style.penColor,
              color: task.style.penColor,
            }}
            onAnimationEnd={() => {
              setIsTypewriterDone(true);
            }}
          >
            <span className="opacity-0">Typing...</span>
          </div>
        ) : (
          <textarea
            id={`task-input-${task.id}`}
            ref={textareaRef}
            className={`w-full bg-transparent border-none p-0 focus:outline-none focus:ring-0 resize-none overflow-hidden ${getFontClass(task.style.fontFamily)} ${
              task.completed ? "line-through text-slate-500/60" : ""
            }`}
            style={{
              color: task.style.penColor,
              caretColor: task.style.penColor,
              height: "auto",
            }}
            rows={1}
            disabled={readOnly || isDeleteMode}
            value={inputValue}
            placeholder="Write task..."
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            autoFocus={isNew}
            aria-label="Task content"
          />
        )}
      </div>

      {/* Delete mode actions overlay */}
      {isDeleteMode && (
        <div
          id={`task-delete-actions-${task.id}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-slate-50 border border-slate-200 shadow-md rounded-lg p-1 z-10"
        >
          {/* Cancel button link */}
          <button
            id={`task-delete-btn-cancel-${task.id}`}
            aria-label="Cancel deletion"
            onClick={(e) => {
              e.stopPropagation();
              setActiveDeleteId(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 transition-colors"
          >
            Cancel
          </button>
          
          {/* Red X button */}
          <button
            id={`task-delete-btn-confirm-${task.id}`}
            aria-label="Confirm deletion"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="flex items-center justify-center w-7 h-7 rounded-md bg-red-500 hover:bg-red-600 text-white shadow-sm transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
