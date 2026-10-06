/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Micro-step rules: progress, and how a checklist drags the parent task
 * between states.
 */

import { SubTask, Task, TaskStatus } from "../types";
import { withStatus } from "../constants/taskStatus";

/** A task may hold at most this many micro-steps. */
export const MAX_SUBTASKS = 10;

export function getSubtaskProgress(task: Pick<Task, "subtasks">): { done: number; total: number } {
  const subs = task.subtasks ?? [];
  return { done: subs.filter((s) => s.completed).length, total: subs.length };
}

export function shouldAutoComplete(task: Pick<Task, "subtasks">): boolean {
  const subs = task.subtasks ?? [];
  return subs.length > 0 && subs.every((s) => s.completed);
}

/**
 * Applies a new checklist to a task and lets it pull the status along:
 *
 *  - every step done  → "done"
 *  - some steps done  → "doing", because work has visibly started
 *  - no steps done    → status untouched
 *
 * Unchecking a step on an auto-completed task lands on "doing" rather than
 * "todo": the person plainly started it, and sending them back to square one
 * would be a lie about their own history.
 *
 * `skipped` is never overridden here — it is an explicit decision, and a
 * stray tap on a checklist shouldn't quietly reverse it.
 */
export function applySubtasks(task: Task, subtasks: SubTask[]): Task {
  const withList: Task = { ...task, subtasks };
  if (subtasks.length === 0 || task.status === "skipped") return withList;

  const doneCount = subtasks.filter((s) => s.completed).length;
  let next: TaskStatus = task.status;

  if (doneCount === subtasks.length) next = "done";
  else if (doneCount > 0) next = "doing";
  else if (task.status === "done") next = "doing"; // was auto-completed, now emptied

  return withStatus(withList, next);
}
