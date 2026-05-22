/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Day, Task } from "../types";
import TaskItem from "./TaskItem";

interface PostItCardProps {
  day: Day;
  onToggleComplete?: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
  activeDeleteId: string | null;
  setActiveDeleteId: (id: string | null) => void;
}

export default function PostItCard({
  day,
  onToggleComplete = (id: string) => {},
  onTextChange = (id: string, text: string) => {},
  onDelete = (id: string) => {},
  readOnly = false,
  activeDeleteId,
  setActiveDeleteId
}: PostItCardProps) {
  // Sort tasks: Active/Incomplete on top, completed tasks at the bottom
  const sortedTasks = [...day.tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // Retain creation order for identical completion status
    return a.createdAt - b.createdAt;
  });

  // Calculate high contrast text or border details based on post-it background
  const postItBgColor = day.style.postItColor || "#fef3c7";

  return (
    <div
      id={`postit-card-${day.id}`}
      className="postit-paper-texture postit-curved-light relative w-full max-w-md p-6 md:p-8 flex flex-col justify-between select-none transition-all duration-300"
      style={{
        borderRadius: "16px 20px 4px 28px",
        backgroundColor: postItBgColor,
        minHeight: "320px",
        height: "auto",
        overflowX: "hidden",

        // 6-layer shadow system simulating curved paper lifted off the surface:
        // Layer 1 — contact shadow (paper touching the desk at center)
        // Layer 2 — mid elevation
        // Layer 3+4 — lateral shadows: raised edges cast wider shadows on the sides
        // Layer 5 — long diffuse shadow of elevated paper
        // Layer 6 — top edge highlight (light coming from above)
        // Layer 7+8 — inset side shadows (paper is not perfectly flat)
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
      {/* Top Bar: Date display (monospace subtle) on left & badge on right */}
      <div className="flex items-center justify-between pointer-events-none select-none mb-4" id="postit-card-topbar">
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

      {/* Primary Task Area inside the Post-it (unbounded to grow with content) */}
      <div
        id="postit-tasks-scrollcontainer"
        className="flex-1 overflow-visible pr-1 flex flex-col gap-1 select-text"
      >
        {sortedTasks.length === 0 ? (
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
        ) : (
          sortedTasks.map((task, index) => {
            // Check if the task is newly created in this session (created within past 2 seconds and text is empty)
            const isNew = !readOnly && !task.text && (Date.now() - task.createdAt < 2000);
            
            return (
              <TaskItem
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onTextChange={onTextChange}
                onDelete={onDelete}
                readOnly={readOnly}
                isNew={isNew}
                activeDeleteId={activeDeleteId}
                setActiveDeleteId={setActiveDeleteId}
              />
            );
          })
        )}
      </div>


    </div>
  );
}
