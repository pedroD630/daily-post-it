/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Day, Task } from "../types";
import TaskItem from "./TaskItem";
import { Reorder } from "motion/react";
import { PostItPaperTexture } from "./PostItPaperTexture";
import type { PaperTextureConfig } from "../constants/palettes";

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
  textureConfig
}: PostItCardProps) {
  // Effective texture flag: per-day snapshot wins; otherwise fall back to the
  // global setting passed via props. This keeps each historical post-it
  // visually stable even if the user later flips the global toggle.
  const effectivePaperTexture =
    day.style.paperTexture !== undefined ? day.style.paperTexture : paperTextureFallback;
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
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-45 pl-1 select-none">
                  Completed Section
                </span>
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
    </div>
  );
}
