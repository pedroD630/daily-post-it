/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Four-column board over TODAY's tasks — the same set the post-it shows.
 * It is not a backlog; earlier days stay in the History tab.
 */

import React, { useMemo, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, TouchSensor, KeyboardSensor,
  closestCorners, useSensor, useSensors,
} from "@dnd-kit/core";
import { Day, Task, TaskStatus } from "../../types";
import { TASK_STATUSES, withStatus } from "../../constants/taskStatus";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import StatusMenuSheet from "./StatusMenuSheet";

interface Props {
  day: Day;
  /** Receives the full, reordered task list for the day. */
  onTasksChange: (tasks: Task[]) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export default function KanbanBoard({ day, onTasksChange, onToggleSubtask }: Props) {
  const [dragging, setDragging] = useState<Task | null>(null);
  const [menuTask, setMenuTask] = useState<Task | null>(null);

  const sensors = useSensors(
    // A small threshold keeps taps, long-press and card-internal buttons
    // working: a press only becomes a drag once the finger actually travels.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const columns = useMemo(() => {
    const byStatus: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [], skipped: [] };
    for (const t of day.tasks) byStatus[t.status]?.push(t);
    for (const s of TASK_STATUSES) {
      byStatus[s].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
    }
    return byStatus;
  }, [day.tasks]);

  /**
   * Rebuilds the whole day in column order and renumbers `order` from zero.
   *
   * The post-it reads the same `order` field, so renumbering only within one
   * column would leave duplicate values across columns and scramble the list
   * over there. Laying the four columns end to end keeps one coherent
   * sequence for both views.
   */
  const commit = (byStatus: Record<TaskStatus, Task[]>) => {
    const flat: Task[] = [];
    for (const s of TASK_STATUSES) for (const t of byStatus[s]) flat.push(t);
    onTasksChange(flat.map((t, index) => ({ ...t, order: index })));
  };

  const columnOf = (overId: string): TaskStatus | null => {
    if (overId.startsWith("col-")) return overId.slice(4) as TaskStatus;
    const task = day.tasks.find((t) => t.id === overId);
    return task ? task.status : null;
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;

    const activeTask = day.tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const target = columnOf(String(over.id));
    if (!target) return;

    const next: Record<TaskStatus, Task[]> = {
      todo: [...columns.todo], doing: [...columns.doing],
      done: [...columns.done], skipped: [...columns.skipped],
    };

    // Lift the card out of wherever it currently sits.
    next[activeTask.status] = next[activeTask.status].filter((t) => t.id !== activeTask.id);

    const moved = withStatus(activeTask, target);

    // Dropped onto another card → land at that card's position.
    const overIndex = next[target].findIndex((t) => t.id === String(over.id));
    if (overIndex >= 0) next[target].splice(overIndex, 0, moved);
    else next[target].push(moved);

    commit(next);
  };

  const moveViaMenu = (status: TaskStatus) => {
    if (!menuTask) return;
    const next: Record<TaskStatus, Task[]> = {
      todo: [...columns.todo], doing: [...columns.doing],
      done: [...columns.done], skipped: [...columns.skipped],
    };
    next[menuTask.status] = next[menuTask.status].filter((t) => t.id !== menuTask.id);
    next[status].push(withStatus(menuTask, status));
    setMenuTask(null);
    commit(next);
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) =>
          setDragging(day.tasks.find((t) => t.id === e.active.id) ?? null)
        }
        onDragCancel={() => setDragging(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory pb-2 -mx-1 px-1">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columns[status]}
              onLongPress={setMenuTask}
              onToggleSubtask={onToggleSubtask}
            />
          ))}
        </div>

        <DragOverlay>
          {dragging ? (
            <div className="rotate-2 opacity-95">
              <KanbanCard task={dragging} sortable={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <StatusMenuSheet task={menuTask} onClose={() => setMenuTask(null)} onPick={moveViaMenu} />
    </div>
  );
}
