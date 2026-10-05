/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Circle, CircleDotDashed, CheckCircle2, XCircle } from "lucide-react";
import { Task, TaskStatus } from "../../types";
import { STATUS_META } from "../../constants/taskStatus";
import KanbanCard from "./KanbanCard";

const ICONS = { Circle, CircleDotDashed, CheckCircle2, XCircle } as const;

interface Props {
  key?: React.Key;
  status: TaskStatus;
  tasks: Task[];
  onLongPress: (task: Task) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export default function KanbanColumn({ status, tasks, onLongPress, onToggleSubtask }: Props) {
  const meta = STATUS_META[status];
  const Icon = ICONS[meta.icon];
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });

  return (
    <section
      id={`kanban-col-${status}`}
      className="shrink-0 w-[80%] md:w-auto md:flex-1 flex flex-col gap-2 snap-start"
    >
      <header className="flex items-center gap-1.5 px-1">
        <Icon className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
        <h3 className="flex-1 font-sans text-xs font-bold uppercase tracking-wider truncate" style={{ color: meta.color }}>
          {meta.label}
        </h3>
        <span className="font-mono text-[11px] text-slate-400 tabular-nums">{tasks.length}</span>
      </header>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[7rem] rounded-xl p-2 flex flex-col gap-2 transition-colors ${
          isOver ? "bg-slate-200/70 dark:bg-slate-700/40" : "bg-slate-100/60 dark:bg-slate-800/40"
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onLongPress={onLongPress}
              onToggleSubtask={onToggleSubtask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex-1 min-h-[5rem] rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
            <span className="text-[11px] text-slate-400">Nenhuma tarefa</span>
          </div>
        )}
      </div>
    </section>
  );
}
