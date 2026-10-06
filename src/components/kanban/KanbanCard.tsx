/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A draggable task card. Keeps the task's own pen colour and font so the
 * board reads as the same handwriting as the post-it.
 */

import React, { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
import { SubTask, Task } from "../../types";
import { getSubtaskProgress } from "../../utils/subtasks";

const LONG_PRESS_MS = 600;

function fontClass(family: string): string {
  if (family.includes("cursive") || family.includes("Caveat")) return "font-handwritten";
  if (family.includes("serif")) return "font-serif";
  return "font-sans";
}

interface Props {
  key?: React.Key;
  task: Task;
  /** Null while rendering inside the DragOverlay, where DnD must stay off. */
  sortable?: boolean;
  onLongPress?: (task: Task) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
}

export default function KanbanCard({ task, sortable = true, onLongPress, onToggleSubtask }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const moved = useRef(false);

  const s = useSortable({ id: task.id, disabled: !sortable });
  const { done, total } = getSubtaskProgress(task);

  const startPress = () => {
    if (!onLongPress) return;
    moved.current = false;
    pressTimer.current = window.setTimeout(() => {
      if (!moved.current) onLongPress(task);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const style: React.CSSProperties = sortable
    ? {
        transform: CSS.Translate.toString(s.transform),
        transition: s.transition,
        opacity: s.isDragging ? 0.4 : 1,
      }
    : {};

  const settled = task.status === "done" || task.status === "skipped";

  return (
    <div
      ref={sortable ? s.setNodeRef : undefined}
      style={style}
      {...(sortable ? s.attributes : {})}
      {...(sortable ? s.listeners : {})}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerMove={() => { moved.current = true; }}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); onLongPress?.(task); }}
      className="rounded-lg bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 shadow-sm px-3 py-2 cursor-grab active:cursor-grabbing touch-none select-none"
    >
      <p
        className={`text-sm leading-snug break-words ${fontClass(task.style.fontFamily)} ${
          task.status === "done" ? "line-through opacity-50" : task.status === "skipped" ? "opacity-40" : ""
        }`}
        style={{ color: task.style.penColor }}
      >
        {task.text.trim() || <span className="opacity-40">(sem título)</span>}
      </p>

      {total > 0 && (
        <>
          {/* 2px progress rule under the text */}
          <div className="mt-1.5 h-0.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${done === total ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-expanded={expanded}
            className="mt-1 flex items-center gap-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {done}/{total} micro passos
          </button>

          {expanded && (
            <ul className="mt-1.5 flex flex-col gap-1">
              {(task.subtasks ?? []).map((sub: SubTask) => (
                <li key={sub.id} className="flex items-start gap-1.5">
                  <button
                    type="button"
                    aria-label={sub.completed ? "Desmarcar micropasso" : "Marcar micropasso"}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onToggleSubtask?.(task.id, sub.id); }}
                    className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center cursor-pointer"
                    style={{
                      borderColor: task.style.penColor,
                      backgroundColor: sub.completed ? task.style.penColor : "transparent",
                    }}
                  >
                    {sub.completed && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                  </button>
                  <span
                    className={`text-[11px] leading-snug ${sub.completed ? "line-through opacity-50" : ""}`}
                    style={{ color: task.style.penColor }}
                  >
                    {sub.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {settled && total === 0 && <span className="sr-only">{task.status}</span>}
    </div>
  );
}
