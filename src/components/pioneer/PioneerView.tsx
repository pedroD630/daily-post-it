/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Aba Pioneiro: field-service tracking and the official S-4-T report.
 * Everything here is local to the device — no network call is made.
 */

import React, { useCallback, useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { FieldEntry, MonthlyReport } from "../../types";
import {
  getAllFieldEntries, saveFieldEntry, deleteFieldEntry,
  getAllMonthlyReports, saveMonthlyReport,
  getBibleStudies, setBibleStudies,
  getReporterName, setReporterName,
} from "../../db";
import { getMonthTotal, getServiceYear, monthIdOf, monthLabel } from "../../utils/serviceYear";
import { stopTimer, startTimer, requestWakeLock, releaseWakeLock } from "../../utils/fieldTimer";
import { generateFieldServicePdf } from "../../utils/reportPdf";
import RegisterTab from "./RegisterTab";
import HistoryTab from "./HistoryTab";
import EntryFormSheet from "./EntryFormSheet";
import ReportFormSheet from "./ReportFormSheet";
import ConfirmSheet from "../ConfirmSheet";
import { auth } from "../../db/firebase";
import {
  pushFieldEntry, pushMonthlyReport, pushBibleStudies, pushReporterName,
} from "../../db/pioneerSync";

type SubTab = "register" | "history";

interface Props {
  timerRunning: boolean;
  onTimerRunningChange: (running: boolean) => void;
  /** Bumped by App after each cloud refresh so this view re-reads IndexedDB. */
  syncTick?: number;
}

export default function PioneerView({ timerRunning, onTimerRunningChange, syncTick = 0 }: Props) {
  const [tab, setTab] = useState<SubTab>("register");
  const [entries, setEntries] = useState<FieldEntry[]>([]);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [studies, setStudies] = useState(0);
  const [reporterName, setName] = useState("");

  // Entry sheet
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FieldEntry | null>(null);
  const [presetMinutes, setPresetMinutes] = useState<number | undefined>(undefined);
  const [entrySource, setEntrySource] = useState<"timer" | "manual">("manual");

  // Discard confirmation when a measured session is cancelled
  const [discardMinutes, setDiscardMinutes] = useState<number | null>(null);

  // Report sheet
  const [reportMonth, setReportMonth] = useState<string | null>(null);

  const currentMonth = monthIdOf();

  const reload = useCallback(async () => {
    const [e, r, s, n] = await Promise.all([
      getAllFieldEntries(), getAllMonthlyReports(), getBibleStudies(currentMonth), getReporterName(),
    ]);
    setEntries(e);
    setReports(r);
    setStudies(s);
    setName(n);
  }, [currentMonth]);

  useEffect(() => { void reload(); }, [reload, syncTick]);

  const handleStart = async () => {
    startTimer();
    onTimerRunningChange(true);
    await requestWakeLock();
  };

  const handleStop = () => {
    const result = stopTimer();
    releaseWakeLock();
    onTimerRunningChange(false);
    // Even a zero-minute session opens the sheet, so a short call can be
    // rounded up by hand instead of silently disappearing.
    setEditingEntry(null);
    setPresetMinutes(result?.totalMinutes ?? 0);
    setEntrySource("timer");
    setEntrySheetOpen(true);
  };

  const handleManual = () => {
    setEditingEntry(null);
    setPresetMinutes(undefined);
    setEntrySource("manual");
    setEntrySheetOpen(true);
  };

  // Local write first, then a background push — the same order the rest of
  // the app uses, so an offline save is never lost waiting on the network.
  // The next cloud refresh reconciles anything a failed push left behind.
  const uid = () => auth.currentUser?.uid;

  const handleSaveEntry = async (entry: FieldEntry) => {
    const stamped = await saveFieldEntry(entry);
    setEntrySheetOpen(false);
    setPresetMinutes(undefined);
    await reload();
    const id = uid();
    if (id) void pushFieldEntry(stamped, id);
  };

  const handleDeleteEntry = async (entryId: string) => {
    const tombstone = await deleteFieldEntry(entryId);
    setEntrySheetOpen(false);
    await reload();
    const id = uid();
    if (id && tombstone) void pushFieldEntry(tombstone, id);
  };

  const handleCloseEntrySheet = () => {
    // A timer session that was never saved is real measured work — confirm
    // before throwing it away.
    if (!editingEntry && entrySource === "timer" && (presetMinutes ?? 0) > 0) {
      setDiscardMinutes(presetMinutes ?? 0);
      return;
    }
    setEntrySheetOpen(false);
    setPresetMinutes(undefined);
  };

  const handleStudiesChange = async (n: number) => {
    setStudies(n);
    const stamped = await setBibleStudies(currentMonth, n);
    const id = uid();
    if (id) void pushBibleStudies(stamped, id);
  };

  const handleGenerate = async (data: { name: string; bibleStudies: number; notes: string }) => {
    if (!reportMonth) return;
    const totalMinutes = getMonthTotal(entries, reportMonth);

    generateFieldServicePdf({
      name: data.name,
      monthLabel: monthLabel(reportMonth),
      totalMinutes,
      bibleStudies: data.bibleStudies,
      notes: data.notes,
    });

    // Snapshot: editing entries later must not change a report already filed.
    const stamped = await saveMonthlyReport({
      id: reportMonth,
      serviceYear: getServiceYear(new Date(reportMonth + "-01T00:00:00")),
      totalMinutes,
      bibleStudies: data.bibleStudies,
      participated: totalMinutes > 0 || data.bibleStudies > 0,
      notes: data.notes,
      generatedAt: Date.now(),
    });
    const nameStamp = Date.now();
    await setReporterName(data.name, nameStamp);
    setReportMonth(null);
    await reload();

    const id = uid();
    if (id) {
      void pushMonthlyReport(stamped, id);
      void pushReporterName(data.name, nameStamp, id);
    }
  };

  const editingMonthReported = editingEntry
    ? reports.some((r) => r.id === editingEntry.date.slice(0, 7))
    : false;

  const tabClass = (active: boolean) =>
    `flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
      active
        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
    }`;

  const discarded = discardMinutes ?? 0;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-24">
      <header className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-sky-500" />
        <h2 className="font-sans font-bold text-lg text-slate-900 dark:text-slate-100">Serviço de campo</h2>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-800/60">
        <button type="button" onClick={() => setTab("register")} className={tabClass(tab === "register")}>Registro</button>
        <button type="button" onClick={() => setTab("history")} className={tabClass(tab === "history")}>Histórico</button>
      </div>

      {tab === "register" ? (
        <RegisterTab
          entries={entries}
          reports={reports}
          bibleStudies={studies}
          timerRunning={timerRunning}
          onStartTimer={handleStart}
          onStopTimer={handleStop}
          onManualEntry={handleManual}
          onBibleStudiesChange={handleStudiesChange}
          onGenerateReport={setReportMonth}
        />
      ) : (
        <HistoryTab
          entries={entries}
          reports={reports}
          onEditEntry={(e) => {
            setEditingEntry(e);
            setPresetMinutes(undefined);
            setEntrySource(e.source);
            setEntrySheetOpen(true);
          }}
        />
      )}

      <EntryFormSheet
        open={entrySheetOpen}
        initial={editingEntry}
        presetMinutes={presetMinutes}
        source={entrySource}
        onClose={handleCloseEntrySheet}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
        deleteWarning={
          editingMonthReported
            ? "O relatório deste mês já foi gerado. Excluir esta entrada não altera o PDF já emitido."
            : undefined
        }
      />

      <ReportFormSheet
        open={reportMonth !== null}
        monthLabel={reportMonth ? monthLabel(reportMonth) : ""}
        totalMinutes={reportMonth ? getMonthTotal(entries, reportMonth) : 0}
        initialName={reporterName}
        initialStudies={studies}
        onClose={() => setReportMonth(null)}
        onGenerate={handleGenerate}
      />

      <ConfirmSheet
        open={discardMinutes !== null}
        title={`Descartar ${Math.floor(discarded / 60)}h ${String(discarded % 60).padStart(2, "0")}min registrados?`}
        message="O tempo medido pelo cronômetro será perdido."
        confirmLabel="Descartar"
        danger
        onConfirm={() => {
          setDiscardMinutes(null);
          setEntrySheetOpen(false);
          setPresetMinutes(undefined);
        }}
        onCancel={() => setDiscardMinutes(null)}
      />
    </div>
  );
}
