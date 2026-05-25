/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Check, X, GripVertical, Clock } from "lucide-react";
import { Task } from "../types";
import { motion, Reorder, useDragControls } from "motion/react";
import { pointValue } from "../utils/points";
import PointsFloat from "./PointsFloat";

interface TaskItemProps {
  key?: React.Key | string;
  task: Task;
  onToggleComplete?: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
  onTextChangeFinished?: (id: string, text: string) => void;
  onTimeChange?: (id: string, time: string | undefined, reminderMinutes: number) => void;
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
  onTextChangeFinished,
  onTimeChange,
  onDelete = (id: string) => {},
  readOnly = false,
  isNew = false,
  activeDeleteId,
  setActiveDeleteId
}: TaskItemProps) {
  const dragControls = useDragControls();
  const Component = readOnly ? motion.div : Reorder.Item;

  const componentProps = readOnly
    ? {}
    : {
        value: task,
        dragListener: false,
        dragControls: dragControls,
      };

  const [inputValue, setInputValue] = useState(task.text);
  const [isTypewriterDone, setIsTypewriterDone] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [localTime, setLocalTime] = useState(task.time);
  const [localReminder, setLocalReminder] = useState(task.reminderMinutes || 10);

  // Floating "+10 / -10" feedback near the checkbox. Cleared by a timer
  // so the same value can re-trigger via key change.
  const [floatPoints, setFloatPoints] = useState<number | null>(null);
  const [floatKey, setFloatKey] = useState(0);
  const floatTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (floatTimerRef.current) clearTimeout(floatTimerRef.current);
    };
  }, []);

  const triggerPointsFloat = (signedPoints: number) => {
    if (floatTimerRef.current) clearTimeout(floatTimerRef.current);
    setFloatPoints(signedPoints);
    setFloatKey((k) => k + 1);
    floatTimerRef.current = setTimeout(() => setFloatPoints(null), 650);
  };

  const isDeleteMode = activeDeleteId === task.id;

  // Sync state if text changes on save or external update
  useEffect(() => {
    setInputValue(task.text);
  }, [task.text]);

  useEffect(() => {
    setLocalTime(task.time);
    setLocalReminder(task.reminderMinutes || 10);
  }, [task.time, task.reminderMinutes]);

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

    if (dx > 10 || dy > 10) {
      handlePressEnd();
    }
  };

  // Focus cleanup on focus loss
  const handleBlur = () => {
    handlePressEnd();
    if (onTextChangeFinished && inputValue !== task.text) {
      onTextChangeFinished(task.id, inputValue);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeVal = e.target.value || undefined;
    setLocalTime(timeVal);
    if (onTimeChange) {
      onTimeChange(task.id, timeVal, localReminder);
    }
  };

  const handleReminderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const minVal = parseInt(e.target.value, 10) || 10;
    setLocalReminder(minVal);
    if (onTimeChange) {
      onTimeChange(task.id, localTime, minVal);
    }
  };

  const handleClearTime = () => {
    setLocalTime(undefined);
    setShowTimePicker(false);
    if (onTimeChange) {
      onTimeChange(task.id, undefined, localReminder);
    }
  };

  return (
    <Component
      id={`task-item-${task.id}`}
      layout
      transition={{ type: "spring", damping: 25, stiffness: 220 }}
      className={`relative group flex flex-col py-1.5 px-3 -mx-2 rounded-lg transition-all duration-200 ${
        isDeleteMode
          ? "ring-2 ring-red-500/80 bg-red-50/20 shadow-sm animate-shake"
          : "hover:bg-black/[0.015]"
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
      {...componentProps}
    >
      <div className="flex items-center w-full min-w-0">
        {/* Dynamic Grip Drag Handle for Reorder */}
        {!readOnly && (
          <div
            aria-label="Drag to reorder"
            onPointerDown={(e) => {
              e.preventDefault();
              dragControls.start(e);
            }}
            className="p-1 -ml-2 mr-1 opacity-25 hover:opacity-100 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing text-slate-500 shrink-0 select-none z-30"
            style={{ touchAction: "none" }}
          >
            <GripVertical className="w-4 h-4 stroke-[2]" />
          </div>
        )}

        {/* Checkbox (wrapped so PointsFloat can position relative to it) */}
        <div className="relative mr-3 shrink-0" style={{ width: "1.25rem", height: "1.25rem" }}>
          <button
            id={`task-checkbox-${task.id}`}
            disabled={readOnly}
            aria-label={task.completed ? "Mark task as incomplete" : "Mark task as complete"}
            onClick={(e) => {
              e.stopPropagation();
              const goingToCompleted = !task.completed;
              const earned = pointValue(task.style.penColor);
              triggerPointsFloat(goingToCompleted ? earned : -earned);
              onToggleComplete(task.id);
            }}
            className="flex items-center justify-center w-5 h-5 border-2 rounded-sm bg-white/50 transition-all cursor-pointer focus:outline-none"
            style={{
              borderColor: task.style.penColor,
              backgroundColor: task.completed ? task.style.penColor : "rgba(255, 255, 255, 0.5)",
            }}
          >
            {task.completed && (
              <Check
                className="w-3.5 h-3.5 text-white stroke-[3.5]"
                style={{ color: "#ffffff" }}
              />
            )}
          </button>
          <PointsFloat
            points={floatPoints}
            color={floatPoints !== null && floatPoints < 0 ? "#dc2626" : task.style.penColor}
            triggerKey={floatKey}
          />
        </div>

        {/* Editable input field */}
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

        {/* Alarm Clock Trigger */}
        {!readOnly && (
          <div className="flex items-center gap-1.5 ml-2 mr-1 z-25 shrink-0 select-none">
            <button
              id={`task-alarm-${task.id}`}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTimePicker(!showTimePicker);
              }}
              className={`p-1 rounded-full transition-all focus:outline-none ${
                localTime
                  ? "bg-amber-100 border border-amber-300 text-amber-800 scale-105 opacity-100 shadow-sm"
                  : "text-slate-700 opacity-60 hover:opacity-100 hover:scale-105"
              }`}
              title={localTime ? `Alert set for ${localTime}` : "Set alert time"}
            >
              <Clock className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
            {localTime && (
              <span className="font-mono text-[9px] text-amber-800 opacity-80 select-none bg-amber-50/70 border border-amber-200/50 px-1 rounded">
                {localTime}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expandable Inline Time Picker Panel */}
      {showTimePicker && !readOnly && (
        <div
          id={`task-timepicker-panel-${task.id}`}
          className="mt-2 p-2 bg-amber-50/95 border border-amber-200 rounded-md shadow-sm z-30 flex flex-wrap items-center gap-2 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-mono text-[9px] text-amber-800 uppercase font-semibold">⏰ Set Alert:</span>
          <input
            id={`task-timepicker-input-${task.id}`}
            type="time"
            value={localTime || ""}
            onChange={handleTimeChange}
            className="bg-white border border-amber-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-xs scale-95"
          />
          {localTime && (
            <>
              <select
                id={`task-timepicker-reminder-${task.id}`}
                value={localReminder}
                onChange={handleReminderChange}
                className="bg-white border border-amber-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-[10px] scale-95"
              >
                <option value="10">10m before</option>
                <option value="30">30m before</option>
                <option value="60">1h before</option>
                <option value="1440">1d before</option>
              </select>
              <button
                id={`task-timepicker-clear-${task.id}`}
                type="button"
                onClick={handleClearTime}
                className="bg-amber-200/70 hover:bg-amber-300/80 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] shadow-sm font-medium ml-auto"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete mode actions overlay */}
      {isDeleteMode && (
        <div
          id={`task-delete-actions-${task.id}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-slate-50 border border-slate-200 shadow-md rounded-lg p-1 z-30"
        >
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
    </Component>
  );
}
