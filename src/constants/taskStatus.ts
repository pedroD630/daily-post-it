/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The four task states, their presentation, and the transition rules.
 */

import { Task, TaskStatus } from "../types";

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done", "skipped"];

export interface StatusMeta {
  label: string;
  /** lucide-react icon name, resolved by the component that renders it. */
  icon: "Circle" | "CircleDotDashed" | "CheckCircle2" | "XCircle";
  /** Accent used for the column header and the status dot. */
  color: string;
  colorDark: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo:    { label: "A fazer",        icon: "Circle",          color: "#64748b", colorDark: "#94a3b8" },
  doing:   { label: "Em andamento",   icon: "CircleDotDashed", color: "#f59e0b", colorDark: "#fbbf24" },
  done:    { label: "Concluídas",     icon: "CheckCircle2",    color: "#10b981", colorDark: "#34d399" },
  skipped: { label: "Não executadas", icon: "XCircle",         color: "#f87171", colorDark: "#fca5a5" },
};

export function isDone(task: { status: TaskStatus }): boolean {
  return task.status === "done";
}

/** Tasks in these states sink to the bottom of the post-it list. */
export function isSettled(status: TaskStatus): boolean {
  return status === "done" || status === "skipped";
}

/**
 * Applies a status change, keeping `completedAt` honest: stamped on entering
 * "done", cleared on leaving it. Returns the same object when nothing moves,
 * so callers can skip a write.
 */
export function withStatus(task: Task, status: TaskStatus): Task {
  if (task.status === status) return task;
  const wasDone = task.status === "done";
  const isNowDone = status === "done";
  return {
    ...task,
    status,
    completedAt: isNowDone ? Date.now() : wasDone ? null : task.completedAt,
  };
}

/**
 * Normalizes a record that predates the status field.
 *
 * Kept as its own function because two paths need it: the one-shot local
 * migration, and the cloud pull — another device still running the old
 * build keeps writing `completed`, and those rows must not arrive as
 * status-less tasks.
 */
export function normalizeTaskStatus(raw: any): Task {
  if (raw?.status) {
    const { completed, ...rest } = raw;
    return rest as Task;
  }
  const { completed, ...rest } = raw ?? {};
  return { ...rest, status: completed === true ? "done" : "todo" } as Task;
}
