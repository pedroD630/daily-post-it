import { createClient } from "@supabase/supabase-js";
import { getAuth } from "firebase/auth";
import { Checkpoint, Day, Goal, Habit, Task } from "../types";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

// Authenticated client: forwards the Firebase ID token on every request so
// Supabase RLS policies can match auth.jwt()->>'sub' against user_id.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => {
        try {
          const user = getAuth().currentUser;
          if (!user) return null;
          return await user.getIdToken();
        } catch {
          return null;
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  : null;

/**
 * Sync helper for Supabase with atomic upsert + safe delete-after-upsert to prevent data loss.
 */
export async function syncDayToSupabase(day: Day, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    // 1. Upsert Day record
    const dayRow: Record<string, unknown> = {
      id: day.id,
      user_id: userId,
      date: day.date,
      created_at: day.createdAt,
      discarded: day.discarded,
      discarded_at: day.discardedAt,
      post_it_color: day.style?.postItColor || "#fef3c7",
      note: day.note ?? null,
      updated_at: day.updatedAt ?? Date.now()
    };

    let { error: dayErr } = await supabase.from("days").upsert(dayRow);

    // Backwards-compat: PostgREST rejects unknown columns (PGRST204) when
    // migrations haven't been run. Strip the offending column(s) and retry
    // so the rest of the day keeps syncing instead of failing wholesale.
    let attemptedRetry = false;
    if (dayErr && (dayErr.code === "PGRST204" || /column/i.test(dayErr.message || ""))) {
      const msg = (dayErr.message || "").toLowerCase();
      if (msg.includes("updated_at")) {
        console.warn("Supabase 'updated_at' column missing — run migration 004_day_updated_at.sql.");
        delete dayRow.updated_at;
        attemptedRetry = true;
      }
      if (msg.includes("note")) {
        console.warn("Supabase 'note' column missing — run migration 003_day_note.sql.");
        delete dayRow.note;
        attemptedRetry = true;
      }
      // Conservative second-pass retry without either schema-added column.
      if (!attemptedRetry) {
        delete dayRow.updated_at;
        delete dayRow.note;
      }
      ({ error: dayErr } = await supabase.from("days").upsert(dayRow));
    }

    if (dayErr) throw dayErr;

    // 2. Map and Upsert current tasks (no deletion before insert!)
    if (day.tasks && day.tasks.length > 0) {
      const dbTasks = day.tasks.map((task: Task) => ({
        id: task.id,
        day_id: day.id,
        user_id: userId,
        text: task.text,
        completed: task.completed,
        completed_at: task.completedAt,
        created_at: task.createdAt,
        sort_order: task.order !== undefined ? task.order : 0,
        pen_color: task.style?.penColor || "#1f2937",
        font_family: task.style?.fontFamily || "sans-serif",
        subtasks: task.subtasks ?? null
      }));

      // Atomic Upsert tasks
      let { error: tasksErr } = await supabase.from("tasks").upsert(dbTasks, {
        onConflict: "id"
      });
      // Fallback if the `subtasks` column migration (010) hasn't been run.
      if (tasksErr && (tasksErr.code === "PGRST204" || /subtasks/i.test(tasksErr.message || ""))) {
        console.warn("Supabase 'subtasks' column missing — run migration 010_task_subtasks.sql. Syncing without it.");
        const stripped = dbTasks.map(({ subtasks, ...rest }) => rest);
        ({ error: tasksErr } = await supabase.from("tasks").upsert(stripped, { onConflict: "id" }));
      }
      if (tasksErr) throw tasksErr;

      // 3. Remove tasks that are no longer in the list (deleted locally)
      const taskIds = dbTasks.map(t => t.id);
      const { error: cleanErr } = await supabase
        .from("tasks")
        .delete()
        .eq("day_id", day.id)
        .eq("user_id", userId)
        .not("id", "in", `(${taskIds.join(",")})`);
      
      if (cleanErr) {
        console.warn("Dangling task cleanup warning:", cleanErr);
      }
    } else {
      // If the post-it has no tasks, remove all tasks for this day
      const { error: clearAllErr } = await supabase
        .from("tasks")
        .delete()
        .eq("day_id", day.id)
        .eq("user_id", userId);
      
      if (clearAllErr) throw clearAllErr;
    }

    return true;
  } catch (err) {
    console.error("Supabase direct sync error:", err);
    return false;
  }
}

/**
 * Upsert the user's current points balance to Supabase. Idempotent —
 * uses the user_id as PK so repeated calls just overwrite the value.
 *
 * Always writes format_version = 1, so any device pulling later knows the
 * row is in the post-migration format (ledger holds non-task adjustments
 * only). Falls back without that column if migration 006 hasn't been run.
 */
export async function syncPointsBalanceToSupabase(userId: string, balance: number): Promise<boolean> {
  if (!supabase) return false;
  try {
    const row: Record<string, unknown> = {
      user_id: userId,
      balance,
      updated_at: Date.now(),
      format_version: 1,
    };
    let { error } = await supabase.from("user_points").upsert(row, { onConflict: "user_id" });
    if (error && (error.code === "PGRST204" || /column|format_version/i.test(error.message || ""))) {
      console.warn("Supabase 'format_version' missing — run migration 006_user_points_format.sql. Syncing without it.");
      delete row.format_version;
      ({ error } = await supabase.from("user_points").upsert(row, { onConflict: "user_id" }));
    }
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Supabase points sync error:", err);
    return false;
  }
}

/**
 * Fetch the user's points balance + write timestamp from Supabase.
 * Returns null if the row doesn't exist yet (first-time user) or on error.
 * The `updatedAt` is used by the caller for last-write-wins merge with the
 * device's local lastUpdated, preventing stale cloud value from clobbering
 * fresh local mutations.
 */
export async function pullPointsBalanceFromSupabase(
  userId: string
): Promise<{ balance: number; updatedAt: number; formatVersion: number } | null> {
  if (!supabase) return null;
  try {
    // Try select with format_version; fall back if the column doesn't exist
    // (migration 006 not yet run).
    let { data, error } = await supabase
      .from("user_points")
      .select("balance, updated_at, format_version")
      .eq("user_id", userId)
      .maybeSingle();
    if (error && (error.code === "PGRST204" || /column|format_version/i.test(error.message || ""))) {
      ({ data, error } = await supabase
        .from("user_points")
        .select("balance, updated_at")
        .eq("user_id", userId)
        .maybeSingle());
    }
    if (error) throw error;
    if (!data) return null;
    return {
      balance: Number(data.balance ?? 0),
      updatedAt: Number(data.updated_at ?? 0),
      formatVersion: Number((data as any).format_version ?? 0),
    };
  } catch (err) {
    console.error("Failed to pull points balance from Supabase:", err);
    return null;
  }
}

/**
 * Pull all data from Supabase for a given user and format it into Day entities.
 */
export async function pullAllDaysFromSupabase(userId: string): Promise<Day[]> {
  if (!supabase) return [];
  try {
    // Fetch days
    const { data: dbDays, error: daysErr } = await supabase
      .from("days")
      .select("*")
      .eq("user_id", userId);
    
    if (daysErr) throw daysErr;

    // Fetch tasks
    const { data: dbTasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId);
    
    if (tasksErr) throw tasksErr;

    const daysMap = new Map<string, Day>();
    
    (dbDays || []).forEach((d: any) => {
      daysMap.set(d.id, {
        id: d.id,
        date: d.date,
        createdAt: Number(d.created_at || Date.now()),
        discarded: !!d.discarded,
        discardedAt: d.discarded_at ? Number(d.discarded_at) : null,
        style: {
          postItColor: d.post_it_color || "#fef3c7"
        },
        tasks: [],
        note: d.note || undefined,
        updatedAt: d.updated_at ? Number(d.updated_at) : 0
      });
    });

    (dbTasks || []).forEach((t: any) => {
      const parentDay = daysMap.get(t.day_id);
      if (parentDay) {
        parentDay.tasks.push({
          id: t.id,
          text: t.text || "",
          completed: !!t.completed,
          completedAt: t.completed_at ? Number(t.completed_at) : null,
          createdAt: Number(t.created_at || Date.now()),
          order: t.sort_order !== undefined ? t.sort_order : 0,
          style: {
            penColor: t.pen_color || "#1f2937",
            fontFamily: t.font_family || "sans-serif"
          },
          subtasks: Array.isArray(t.subtasks) ? t.subtasks : undefined
        });
      }
    });

    // Sort order within each day's task list
    const finalDays = Array.from(daysMap.values());
    finalDays.forEach((fd) => {
      fd.tasks.sort((a, b) => a.order - b.order);
    });

    return finalDays;
  } catch (err) {
    console.error("Failed to pull from Supabase PostgreSQL database:", err);
    return [];
  }
}

/* -------------------------------------------------------------------------
 * Goals — long-term objectives synced cross-device.
 * If the `goals` table isn't created yet (PGRST205), every call is a no-op
 * so the rest of the app keeps working until the migration is run.
 * ----------------------------------------------------------------------- */

function isMissingGoalsTable(err: any): boolean {
  if (!err) return false;
  const code = err.code || "";
  const msg = (err.message || "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || msg.includes("goals");
}

export async function syncGoalToSupabase(goal: Goal, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("goals").upsert({
      id: goal.id,
      user_id: userId,
      title: goal.title,
      deadline: goal.deadline,
      keywords: goal.keywords,
      target_amount: goal.targetFrequency.amount,
      target_unit: goal.targetFrequency.unit,
      base_color: goal.baseColor,
      created_at: goal.createdAt,
      archived: goal.archived,
      updated_at: goal.updatedAt ?? Date.now()
    }, { onConflict: "id" });
    if (error) {
      if (isMissingGoalsTable(error)) {
        console.warn("Supabase 'goals' table missing — run migration 005_goals.sql.");
        return false;
      }
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Supabase goals sync error:", err);
    return false;
  }
}

export async function deleteGoalFromSupabase(goalId: string, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", goalId)
      .eq("user_id", userId);
    if (error && !isMissingGoalsTable(error)) throw error;
    return true;
  } catch (err) {
    console.error("Supabase goals delete error:", err);
    return false;
  }
}

export async function pullAllGoalsFromSupabase(userId: string): Promise<Goal[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId);
    if (error) {
      if (isMissingGoalsTable(error)) {
        console.warn("Supabase 'goals' table missing — run migration 005_goals.sql.");
        return [];
      }
      throw error;
    }
    return (data || []).map((g: any): Goal => ({
      id: g.id,
      title: g.title,
      deadline: g.deadline,
      keywords: Array.isArray(g.keywords) ? g.keywords : [],
      targetFrequency: {
        amount: Number(g.target_amount ?? 1),
        unit: (g.target_unit as Goal["targetFrequency"]["unit"]) ?? "week",
      },
      baseColor: g.base_color || "#e5e7eb",
      createdAt: Number(g.created_at || Date.now()),
      archived: !!g.archived,
      updatedAt: g.updated_at ? Number(g.updated_at) : 0,
    }));
  } catch (err) {
    console.error("Failed to pull goals from Supabase:", err);
    return [];
  }
}

/* -------------------------------------------------------------------------
 * Checkpoints — AI-proposed milestones. Same no-op-if-table-missing pattern.
 * ----------------------------------------------------------------------- */

function isMissingCheckpointsTable(err: any): boolean {
  if (!err) return false;
  const code = err.code || "";
  const msg = (err.message || "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || msg.includes("checkpoints");
}

export async function syncCheckpointToSupabase(cp: Checkpoint, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const row: Record<string, unknown> = {
      id: cp.id,
      user_id: userId,
      goal_id: cp.goalId,
      title: cp.title,
      description: cp.description ?? null,
      achieved: cp.achieved,
      achieved_at: cp.achievedAt,
      created_at: cp.createdAt,
      sort_order: cp.order,
      source: cp.source,
      updated_at: cp.updatedAt ?? Date.now(),
      deleted: cp.deleted ?? false
    };
    let { error } = await supabase.from("checkpoints").upsert(row, { onConflict: "id" });
    // Fallback if the `deleted` column migration (008) hasn't been run yet.
    if (error && (error.code === "PGRST204" || /deleted/i.test(error.message || ""))) {
      console.warn("Supabase 'deleted' column missing — run migration 008_checkpoints_deleted.sql. Syncing without it.");
      delete row.deleted;
      ({ error } = await supabase.from("checkpoints").upsert(row, { onConflict: "id" }));
    }
    if (error) {
      if (isMissingCheckpointsTable(error)) {
        console.warn("Supabase 'checkpoints' table missing — run migration 007_checkpoints.sql.");
        return false;
      }
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Supabase checkpoints sync error:", err);
    return false;
  }
}

export async function deleteCheckpointFromSupabase(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("checkpoints").delete().eq("id", id).eq("user_id", userId);
    if (error && !isMissingCheckpointsTable(error)) throw error;
    return true;
  } catch (err) {
    console.error("Supabase checkpoints delete error:", err);
    return false;
  }
}

export async function pullAllCheckpointsFromSupabase(userId: string): Promise<Checkpoint[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from("checkpoints").select("*").eq("user_id", userId);
    if (error) {
      if (isMissingCheckpointsTable(error)) {
        console.warn("Supabase 'checkpoints' table missing — run migration 007_checkpoints.sql.");
        return [];
      }
      throw error;
    }
    return (data || []).map((c: any): Checkpoint => ({
      id: c.id,
      goalId: c.goal_id,
      title: c.title,
      description: c.description || undefined,
      achieved: !!c.achieved,
      achievedAt: c.achieved_at ? Number(c.achieved_at) : null,
      createdAt: Number(c.created_at || Date.now()),
      order: Number(c.sort_order ?? 0),
      source: (c.source === "user" ? "user" : "ai"),
      updatedAt: c.updated_at ? Number(c.updated_at) : 0,
      deleted: !!c.deleted,
    }));
  } catch (err) {
    console.error("Failed to pull checkpoints from Supabase:", err);
    return [];
  }
}

/* -------------------------------------------------------------------------
 * Habits — quit-habit streak tracker. Soft-delete via `deleted` tombstone,
 * same resilient no-op-if-table-missing pattern as checkpoints.
 * ----------------------------------------------------------------------- */

function isMissingHabitsTable(err: any): boolean {
  if (!err) return false;
  const code = err.code || "";
  const msg = (err.message || "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || msg.includes("habits");
}

export async function syncHabitToSupabase(habit: Habit, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("habits").upsert({
      id: habit.id,
      user_id: userId,
      name: habit.name,
      icon: habit.icon,
      last_relapse_date: habit.lastRelapseDate,
      created_at: habit.createdAt,
      active: habit.active,
      updated_at: habit.updatedAt ?? Date.now(),
      deleted: habit.deleted ?? false
    }, { onConflict: "id" });
    if (error) {
      if (isMissingHabitsTable(error)) {
        console.warn("Supabase 'habits' table missing — run migration 009_habits.sql.");
        return false;
      }
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Supabase habits sync error:", err);
    return false;
  }
}

export async function pullAllHabitsFromSupabase(userId: string): Promise<Habit[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from("habits").select("*").eq("user_id", userId);
    if (error) {
      if (isMissingHabitsTable(error)) {
        console.warn("Supabase 'habits' table missing — run migration 009_habits.sql.");
        return [];
      }
      throw error;
    }
    return (data || []).map((h: any): Habit => ({
      id: h.id,
      name: h.name,
      icon: h.icon || "🔒",
      lastRelapseDate: h.last_relapse_date,
      createdAt: Number(h.created_at || Date.now()),
      active: h.active === false ? false : true,
      updatedAt: h.updated_at ? Number(h.updated_at) : 0,
      deleted: !!h.deleted,
    }));
  } catch (err) {
    console.error("Failed to pull habits from Supabase:", err);
    return [];
  }
}
