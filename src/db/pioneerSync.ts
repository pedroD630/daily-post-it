/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cross-device sync for the Pioneiro module: field entries, generated
 * reports, bible-study counts and the reporter's name.
 *
 * Deliberately a separate file from the days/tasks sync. It shares no code
 * path with syncDayToCloud, so nothing here can affect task syncing.
 *
 * The running stopwatch is NOT synced — it lives in localStorage on the
 * device that started it, which is what you want: a timer started on the
 * phone shouldn't appear running on the laptop. Only the saved outing
 * travels, and it travels the moment it is saved.
 *
 * Merge rules follow the same principle as the task fix: a record missing
 * on one side is news, not a deletion. Rows only disappear via an explicit
 * `deleted` tombstone.
 */

import { supabase } from "./supabase";
import { BibleStudyCount, FieldEntry, MonthlyReport } from "../types";
import {
  getAllFieldEntriesRaw, getAllMonthlyReportsRaw, getAllBibleStudies,
  getReporterNameRecord, setReporterName, putPioneerRecord,
} from "./index";

function isMissingTable(err: any): boolean {
  if (!err) return false;
  const code = err.code || "";
  const msg = (err.message || "").toLowerCase();
  return code === "PGRST205" || code === "42P01"
    || msg.includes("field_entries") || msg.includes("monthly_reports")
    || msg.includes("bible_studies") || msg.includes("pioneer_profile");
}

function warnMissing(what: string): void {
  console.warn(`Supabase '${what}' table missing — run migration 014_pioneer.sql.`);
}

/* --- Push (called right after each local save) -------------------------- */

export async function pushFieldEntry(entry: FieldEntry, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("field_entries").upsert({
      id: entry.id,
      user_id: userId,
      date: entry.date,
      minutes: entry.minutes,
      created_at: entry.createdAt,
      source: entry.source,
      updated_at: entry.updatedAt ?? Date.now(),
      deleted: entry.deleted ?? false,
    }, { onConflict: "id" });
    if (error) {
      if (isMissingTable(error)) { warnMissing("field_entries"); return false; }
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Pioneer field_entries push failed:", err);
    return false;
  }
}

export async function pushMonthlyReport(report: MonthlyReport, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("monthly_reports").upsert({
      user_id: userId,
      id: report.id,
      service_year: report.serviceYear,
      total_minutes: report.totalMinutes,
      bible_studies: report.bibleStudies,
      participated: report.participated,
      notes: report.notes,
      generated_at: report.generatedAt,
      updated_at: report.updatedAt ?? Date.now(),
      deleted: report.deleted ?? false,
    }, { onConflict: "user_id,id" });
    if (error) {
      if (isMissingTable(error)) { warnMissing("monthly_reports"); return false; }
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Pioneer monthly_reports push failed:", err);
    return false;
  }
}

export async function pushBibleStudies(record: BibleStudyCount, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("bible_studies").upsert({
      user_id: userId,
      id: record.id,
      count: record.count,
      updated_at: record.updatedAt ?? Date.now(),
    }, { onConflict: "user_id,id" });
    if (error) {
      if (isMissingTable(error)) { warnMissing("bible_studies"); return false; }
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Pioneer bible_studies push failed:", err);
    return false;
  }
}

export async function pushReporterName(name: string, updatedAt: number, userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("pioneer_profile").upsert({
      user_id: userId,
      reporter_name: name,
      updated_at: updatedAt,
    }, { onConflict: "user_id" });
    if (error) {
      if (isMissingTable(error)) { warnMissing("pioneer_profile"); return false; }
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Pioneer profile push failed:", err);
    return false;
  }
}

/* --- Bidirectional merge (called on cloud refresh) ---------------------- */

/**
 * Pulls everything, writes the fresher side locally, and pushes anything the
 * cloud is missing or stale on. Safe to call repeatedly.
 */
export async function syncPioneerData(userId: string): Promise<void> {
  if (!supabase) return;

  await Promise.all([
    mergeFieldEntries(userId),
    mergeMonthlyReports(userId),
    mergeBibleStudies(userId),
    mergeReporterName(userId),
  ]);
}

async function mergeFieldEntries(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase!.from("field_entries").select("*").eq("user_id", userId);
    if (error) {
      if (isMissingTable(error)) { warnMissing("field_entries"); return; }
      throw error;
    }
    const cloud: FieldEntry[] = (data || []).map((r: any) => ({
      id: r.id,
      date: r.date,
      minutes: Number(r.minutes ?? 0),
      createdAt: Number(r.created_at ?? Date.now()),
      source: r.source === "timer" ? "timer" : "manual",
      updatedAt: r.updated_at ? Number(r.updated_at) : 0,
      deleted: !!r.deleted,
    }));

    const local = await getAllFieldEntriesRaw();
    const localById = new Map(local.map((e) => [e.id, e]));
    const cloudById = new Map(cloud.map((e) => [e.id, e]));

    for (const c of cloud) {
      const l = localById.get(c.id);
      if ((c.updatedAt ?? 0) >= (l?.updatedAt ?? 0)) {
        await putPioneerRecord("field_entries", c);
      }
    }
    for (const l of local) {
      const c = cloudById.get(l.id);
      if (!c || (l.updatedAt ?? 0) > (c.updatedAt ?? 0)) {
        void pushFieldEntry(l, userId);
      }
    }
  } catch (err) {
    console.warn("Pioneer field entries merge failed:", err);
  }
}

async function mergeMonthlyReports(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase!.from("monthly_reports").select("*").eq("user_id", userId);
    if (error) {
      if (isMissingTable(error)) { warnMissing("monthly_reports"); return; }
      throw error;
    }
    const cloud: MonthlyReport[] = (data || []).map((r: any) => ({
      id: r.id,
      serviceYear: r.service_year || "",
      totalMinutes: Number(r.total_minutes ?? 0),
      bibleStudies: Number(r.bible_studies ?? 0),
      participated: !!r.participated,
      notes: r.notes || "",
      generatedAt: Number(r.generated_at ?? Date.now()),
      updatedAt: r.updated_at ? Number(r.updated_at) : 0,
      deleted: !!r.deleted,
    }));

    const local = await getAllMonthlyReportsRaw();
    const localById = new Map(local.map((r) => [r.id, r]));
    const cloudById = new Map(cloud.map((r) => [r.id, r]));

    for (const c of cloud) {
      const l = localById.get(c.id);
      if ((c.updatedAt ?? 0) >= (l?.updatedAt ?? 0)) {
        await putPioneerRecord("monthly_reports", c);
      }
    }
    for (const l of local) {
      const c = cloudById.get(l.id);
      if (!c || (l.updatedAt ?? 0) > (c.updatedAt ?? 0)) {
        void pushMonthlyReport(l, userId);
      }
    }
  } catch (err) {
    console.warn("Pioneer reports merge failed:", err);
  }
}

async function mergeBibleStudies(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase!.from("bible_studies").select("*").eq("user_id", userId);
    if (error) {
      if (isMissingTable(error)) { warnMissing("bible_studies"); return; }
      throw error;
    }
    const cloud: BibleStudyCount[] = (data || []).map((r: any) => ({
      id: r.id,
      count: Number(r.count ?? 0),
      updatedAt: r.updated_at ? Number(r.updated_at) : 0,
    }));

    const local = await getAllBibleStudies();
    const localById = new Map(local.map((b) => [b.id, b]));
    const cloudById = new Map(cloud.map((b) => [b.id, b]));

    for (const c of cloud) {
      const l = localById.get(c.id);
      if ((c.updatedAt ?? 0) >= (l?.updatedAt ?? 0)) {
        await putPioneerRecord("bible_studies", c);
      }
    }
    for (const l of local) {
      const c = cloudById.get(l.id);
      if (!c || (l.updatedAt ?? 0) > (c.updatedAt ?? 0)) {
        void pushBibleStudies(l, userId);
      }
    }
  } catch (err) {
    console.warn("Pioneer bible studies merge failed:", err);
  }
}

async function mergeReporterName(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase!
      .from("pioneer_profile").select("*").eq("user_id", userId).maybeSingle();
    if (error) {
      if (isMissingTable(error)) { warnMissing("pioneer_profile"); return; }
      throw error;
    }
    const local = await getReporterNameRecord();
    const cloudUpdated = data?.updated_at ? Number(data.updated_at) : 0;

    if (data && cloudUpdated > local.updatedAt) {
      await setReporterName(data.reporter_name || "", cloudUpdated);
    } else if (local.name && local.updatedAt > cloudUpdated) {
      void pushReporterName(local.name, local.updatedAt, userId);
    }
  } catch (err) {
    console.warn("Pioneer profile merge failed:", err);
  }
}
