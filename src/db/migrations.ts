/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One-shot local data migrations.
 */

import { Task } from "../types";
import { normalizeTaskStatus } from "../constants/taskStatus";
import { getAllDaysRaw, saveDay } from "./index";

const MIGRATION_KEY = "migration_task_status_v1";

/**
 * Rewrites stored tasks from `completed: boolean` to `status: TaskStatus`.
 *
 * Runs once, flagged in localStorage. The flag is only an optimisation: the
 * cloud pull normalizes independently (see normalizeTaskStatus), because a
 * second device still on the old build keeps writing `completed` rows long
 * after this has run here. Correctness never depends on the flag.
 */
export async function migrateTasksToStatus(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY) === "done") return;

  try {
    const days = await getAllDaysRaw();
    for (const day of days) {
      let changed = false;
      const tasks: Task[] = (day.tasks ?? []).map((t: any) => {
        if (t?.status !== undefined && t?.completed === undefined) return t as Task;
        changed = true;
        return normalizeTaskStatus(t);
      });
      // saveDay re-stamps only the tasks whose content actually changed, so a
      // migrated day doesn't spuriously win merges against other devices.
      if (changed) await saveDay({ ...day, tasks });
    }
    localStorage.setItem(MIGRATION_KEY, "done");
  } catch (err) {
    // Leave the flag unset so the next boot retries rather than running on
    // half-converted data.
    console.error("Task status migration failed:", err);
  }
}
