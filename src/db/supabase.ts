import { createClient } from "@supabase/supabase-js";
import { Day, Task } from "../types";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

// Graceful client creation to prevent startup failures for clients who haven't set up credentials yet
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Sync helper for Supabase with atomic upsert + safe delete-after-upsert to prevent data loss.
 */
export async function syncDayToSupabase(day: Day, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    // 1. Upsert Day record
    const { error: dayErr } = await supabase.from("days").upsert({
      id: day.id,
      user_id: userId,
      date: day.date,
      created_at: day.createdAt,
      discarded: day.discarded,
      discarded_at: day.discardedAt,
      post_it_color: day.style?.postItColor || "#fef3c7"
    });

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
        font_family: task.style?.fontFamily || "sans-serif"
      }));

      // Atomic Upsert tasks
      const { error: tasksErr } = await supabase.from("tasks").upsert(dbTasks, {
        onConflict: "id"
      });
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
        tasks: []
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
          }
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
