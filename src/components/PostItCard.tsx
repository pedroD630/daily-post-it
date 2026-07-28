/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Day, Task } from "../types";
import TaskItem from "./TaskItem";
import { Reorder } from "motion/react";
import { Zap, AlertTriangle, Flame } from "lucide-react";
import { PostItPaperTexture } from "./PostItPaperTexture";
import ConfettiBurst from "./ConfettiBurst";
import type { PaperTextureConfig } from "../constants/palettes";
import { formatBalance } from "../utils/points";

interface PostItCardProps {
  day: Day;
  onToggleComplete?: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
  onTextChangeFinished?: (id: string, text: string) => void;
  onTimeChange?: (id: string, time: string | undefined, reminderMinutes: number) => void;
  onDelete?: (id: string) => void;
  onReorderTasks?: (tasks: Task[]) => void;
  readOnly?: boolean;
  activeDeleteId: string | null;
  setActiveDeleteId: (id: string | null) => void;
  calendarEvents?: any[];
  /**
   * Default texture setting (typically settings.paperTexture). Used as a
   * fallback when this specific day was created without a snapshot.
   * day.style.paperTexture (if defined) wins over this.
   */
  paperTexture?: boolean;
  /**
   * Texture configuration from the currently active palette. The component
   * resolves whether to actually render via paperTexture flag + day snapshot.
   */
  textureConfig?: PaperTextureConfig;
  /**
   * Current points balance, displayed bottom-left as a small indicator.
   * Undefined hides the indicator (e.g. in history view if not relevant).
   */
  pointsBalance?: number;
  /** Fires on blur with the final scratchpad note text. */
  onNoteChange?: (note: string) => void;
  /** Current productivity streak; rendered as a flame chip when >= 2. */
  streak?: number;
  /** Invoked when the streak chip is tapped (e.g. open Insights). */
  onOpenInsights?: () => void;
}

export default function PostItCard({
  day,
  onToggleComplete = (id: string) => {},
  onTextChange = (id: string, text: string) => {},
  onTextChangeFinished,
  onTimeChange,
  onDelete = (id: string) => {},
  onReorderTasks,
  readOnly = false,
  activeDeleteId,
  setActiveDeleteId,
  calendarEvents = [],
  paperTexture: paperTextureFallback = true,
  textureConfig,
  pointsBalance,
  onNoteChange,
  streak = 0,
  onOpenInsights
}: PostItCardProps) {
  // Effective texture flag: per-day snapshot wins; otherwise fall back to the
  // global setting passed via props. This keeps each historical post-it
  // visually stable even if the user later flips the global toggle.
  const effectivePaperTexture =
    day.style.paperTexture !== undefined ? day.style.paperTexture : paperTextureFallback;

  // Scratchpad note — local while typing, committed via onNoteChange on blur
  const [noteText, setNoteText] = useState(day.note || "");
  useEffect(() => {
    setNoteText(day.note || "");
  }, [day.id, day.note]);

  // Density controls: keep the card light. Completed tasks collapse when many;
  // the note scratchpad only expands on demand (or when it already has text).
  const [showCompleted, setShowCompleted] = useState(false);
  const [showNote, setShowNote] = useState(!!(day.note && day.note.trim()));
  useEffect(() => {
    setShowNote(!!(day.note && day.note.trim()));
  }, [day.id, day.note]);

  // All-done celebration: fire confetti when the LAST task gets completed.
  // Rising-edge detection so reloads/readonly cards never re-fire.
  const allDone = !readOnly && day.tasks.length > 0 && day.tasks.every((t) => t.completed);
  const prevAllDoneRef = useRef(allDone);
  const [confettiBurst, setConfettiBurst] = useState(0);
  useEffect(() => {
    if (allDone && !prevAllDoneRef.current) {
      setConfettiBurst((b) => b + 1);
    }
    prevAllDoneRef.current = allDone;
  }, [allDone]);
  // Separate and sort tasks by explicit order field, fallback to creation time
  const incompleteTasks = day.tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.createdAt - b.createdAt;
    });

  const completedTasks = day.tasks
    .filter((t) => t.completed)
    .sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.completedAt && b.completedAt
        ? a.completedAt - b.completedAt
        : a.createdAt - b.createdAt;
    });

  const handleReorderIncomplete = (newIncomplete: Task[]) => {
    if (onReorderTasks) {
      const reorderedIncomplete = newIncomplete.map((t, index) => ({
        ...t,
        order: index,
      }));
      const reorderedCompleted = completedTasks.map((t, index) => ({
        ...t,
        order: index,
      }));
      onReorderTasks([...reorderedIncomplete, ...reorderedCompleted]);
    }
  };

  const handleReorderCompleted = (newCompleted: Task[]) => {
    if (onReorderTasks) {
      const reorderedIncomplete = incompleteTasks.map((t, index) => ({
        ...t,
        order: index,
      }));
      const reorderedCompleted = newCompleted.map((t, index) => ({
        ...t,
        order: index,
      }));
      onReorderTasks([...reorderedIncomplete, ...reorderedCompleted]);
    }
  };

  // Combine them cleanly for read-only static rendering
  const sortedTasks = [...incompleteTasks, ...completedTasks];

  const postItBgColor = day.style.postItColor || "#fef3c7";

  return (
    <div
      id={`postit-card-${day.id}`}
      className={`postit-paper-texture postit-curved-light relative w-full max-w-md p-6 md:p-8 flex flex-col justify-between select-none transition-all duration-300`}
      style={{
        borderRadius: "16px 20px 4px 28px",
        backgroundColor: postItBgColor,
        minHeight: "320px",
        height: "auto",
        overflowX: "hidden",
        boxShadow: `
          0 2px 3px rgba(0,0,0,0.12),
          0 6px 12px rgba(0,0,0,0.10),
          4px 10px 20px rgba(0,0,0,0.09),
          -4px 10px 20px rgba(0,0,0,0.09),
          0 20px 40px rgba(0,0,0,0.07),
          inset 0 1px 0 rgba(255,255,255,0.55),
          inset 3px 0 8px rgba(0,0,0,0.025),
          inset -3px 0 8px rgba(0,0,0,0.025)
        `,
      }}
    >
      {/* WebGL paper-texture overlay — palette-aware. Text below stays readable
          because mix-blend-mode: multiply leaves white-ish areas unchanged and
          only darkens where the noise particles (colorFront) are. */}
      {effectivePaperTexture && textureConfig && (
        <PostItPaperTexture config={textureConfig} />
      )}
      {/* Top Bar — explicit z-index lifts it above the absolutely-positioned shader overlay */}
      <div className="relative z-10 flex items-center justify-between pointer-events-none select-none mb-4" id="postit-card-topbar">
        <span
          id="postit-date-display"
          className="font-mono text-xs opacity-50 tracking-wider font-semibold"
          style={{ mixBlendMode: "multiply" }}
        >
          {day.date}
        </span>

        <div className="flex items-center gap-2">
          {/* Streak flame chip — tap to open Insights */}
          {!readOnly && streak >= 2 && (
            <button
              id="postit-streak-chip"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInsights?.();
              }}
              title={`${streak}-day streak — view insights`}
              className="pointer-events-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-700 font-mono text-[10px] font-bold cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            >
              <Flame className="w-3 h-3" fill="currentColor" />
              {streak}
            </button>
          )}

          {/* All-done ribbon */}
          {allDone && !day.discarded && (
            <div
              id="postit-alldone-badge"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-emerald-600/15 text-emerald-800 border border-emerald-600/20"
            >
              ✓ All done!
            </div>
          )}

          {day.discarded && (
            <div
              id="postit-discarded-badge"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-black/10 text-slate-800"
              style={{ mixBlendMode: "multiply" }}
            >
              🗑️ Discarded
            </div>
          )}
        </div>
      </div>

      {/* Primary Task Area — relative + z-10 so tasks render above the shader overlay */}
      <div
        id="postit-tasks-scrollcontainer"
        className="relative z-10 flex-1 overflow-visible pr-1 flex flex-col gap-1 select-text"
      >
        {day.tasks.length === 0 ? (
          <div
            id="postit-empty-state"
            className="flex-1 flex flex-col items-center justify-center text-center opacity-60 px-4 pointer-events-none select-none py-10"
          >
            <p className="font-handwritten text-lg text-slate-700/80">
              No tasks for today.
            </p>
            {!readOnly && (
              <p className="text-xs text-slate-500 mt-2 font-mono">
                Tap + below to write...
              </p>
            )}
          </div>
        ) : readOnly ? (
          <div className="flex flex-col gap-1 w-full">
            {sortedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onTextChange={onTextChange}
                onTextChangeFinished={onTextChangeFinished}
                onTimeChange={onTimeChange}
                onDelete={onDelete}
                readOnly={readOnly}
                isNew={false}
                activeDeleteId={activeDeleteId}
                setActiveDeleteId={setActiveDeleteId}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 w-full">
            {incompleteTasks.length > 0 && (
              <Reorder.Group
                axis="y"
                values={incompleteTasks}
                onReorder={handleReorderIncomplete}
                as="div"
                className="flex flex-col gap-1 w-full"
              >
                {incompleteTasks.map((task) => {
                  const isNew = !task.text && Date.now() - task.createdAt < 2000;
                  return (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggleComplete={onToggleComplete}
                      onTextChange={onTextChange}
                      onTextChangeFinished={onTextChangeFinished}
                      onTimeChange={onTimeChange}
                      onDelete={onDelete}
                      readOnly={readOnly}
                      isNew={isNew}
                      activeDeleteId={activeDeleteId}
                      setActiveDeleteId={setActiveDeleteId}
                    />
                  );
                })}
              </Reorder.Group>
            )}

            {completedTasks.length > 0 && (
              <div className="flex flex-col gap-2 pt-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider opacity-45 hover:opacity-80 pl-1 cursor-pointer w-fit"
                >
                  {showCompleted ? "▾" : "▸"} Concluídas ({completedTasks.length})
                </button>
                {showCompleted && (
                  <Reorder.Group
                    axis="y"
                    values={completedTasks}
                    onReorder={handleReorderCompleted}
                    as="div"
                    className="flex flex-col gap-1 w-full"
                  >
                    {completedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onTextChange={onTextChange}
                        onTextChangeFinished={onTextChangeFinished}
                        onTimeChange={onTimeChange}
                        onDelete={onDelete}
                        readOnly={readOnly}
                        isNew={false}
                        activeDeleteId={activeDeleteId}
                        setActiveDeleteId={setActiveDeleteId}
                      />
                    ))}
                  </Reorder.Group>
                )}
              </div>
            )}

            {calendarEvents && calendarEvents.length > 0 && (
              <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-dashed border-black/15 select-none" id="postit-google-calendar-block">
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-40 pl-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Today's Google Calendar Events
                </span>
                <div className="flex flex-col gap-1.5 pl-1.5 text-stone-700/90 font-serif text-xs leading-normal">
                  {calendarEvents.slice(0, 5).map((evt: any) => {
                    const timeStr = evt.start?.dateTime
                      ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "All Day";
                    return (
                      <div key={evt.id} className="flex items-center justify-between gap-2 max-w-full">
                        <span className="truncate flex-1 tracking-tight" style={{ fontFamily: "inherit" }}>
                          ✦ {evt.summary}
                        </span>
                        <span className="font-mono text-[9px] opacity-60 text-stone-500 border border-black/5 bg-black/[0.01] px-1 rounded hover:opacity-100 shrink-0">
                          {timeStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day-note scratchpad — collapsed by default to keep the card light.
          Expands on demand (or auto-open when there's already note text). */}
      {(onNoteChange || (readOnly && day.note)) && (
        <div
          id={`postit-note-area-${day.id}`}
          className="relative z-10 mt-4 pt-3 border-t border-dashed border-black/15 select-text"
        >
          {readOnly ? (
            day.note && (
              <>
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-40 pl-1 select-none">✎ Notas</span>
                <p className="scratchpad-lines font-handwritten text-sm text-slate-700/90 px-1 mt-1 whitespace-pre-wrap break-words">
                  {day.note}
                </p>
              </>
            )
          ) : showNote ? (
            <>
              <span className="text-[10px] uppercase font-mono tracking-wider opacity-40 pl-1 select-none">✎ Notas</span>
              <textarea
                id={`postit-note-input-${day.id}`}
                value={noteText}
                autoFocus={!day.note}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={() => {
                  if (noteText !== (day.note || "")) {
                    onNoteChange?.(noteText);
                  }
                  if (!noteText.trim()) setShowNote(false);
                }}
                placeholder="Anote uma ideia, um pensamento…"
                rows={Math.max(2, noteText.split("\n").length)}
                className="scratchpad-lines w-full bg-transparent resize-none outline-none font-handwritten text-sm text-slate-700/90 placeholder:text-slate-500/40 px-1 mt-1 break-words"
                style={{ minHeight: "56px" }}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider opacity-40 hover:opacity-80 pl-1 cursor-pointer"
            >
              ✎ Adicionar nota
            </button>
          )}
        </div>
      )}

      {/* Confetti celebration when the last task is completed */}
      <ConfettiBurst burst={confettiBurst} />

      {/* Points balance indicator — bottom-left of the post-it.
          Subtle when positive, bold red when in the negative. */}
      {pointsBalance !== undefined && (
        <div
          id="postit-points-balance"
          className={`absolute bottom-2 left-3 z-10 flex items-center gap-1 font-mono text-[11px] select-none pointer-events-none ${
            pointsBalance < 0 ? "text-red-600 opacity-100 font-bold" : "text-slate-800 opacity-50"
          }`}
          style={{ mixBlendMode: pointsBalance < 0 ? "normal" : "multiply" }}
        >
          {pointsBalance < 0 ? (
            <AlertTriangle className="w-3 h-3" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          <span>{formatBalance(pointsBalance)} pts</span>
        </div>
      )}
    </div>
  );
}
