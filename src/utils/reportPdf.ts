/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Renders the official S-4-T field service report as a PDF, entirely in the
 * browser via jsPDF. No server, no network, no cost.
 *
 * jsPDF's built-in Helvetica uses cp1252, which covers every accented
 * character Portuguese needs, so no font has to be embedded.
 */

import { jsPDF } from "jspdf";

export interface FieldReportData {
  name: string;
  monthLabel: string;   // "Setembro 2026"
  totalMinutes: number;
  bibleStudies: number;
  notes: string;
}

const INK = 20;          // near-black for rules
const FILL: [number, number, number] = [237, 240, 252]; // pale blue value cells

/** Builds the document. Separated from the download so it can be rendered
 *  and inspected without triggering a browser save. */
export function buildFieldServicePdf(report: FieldReportData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const M = 25;                 // left margin
  const W = 160;                // usable width
  const R = M + W;              // right edge
  const valueColW = 28;         // right-hand value column
  const colX = R - valueColW;

  doc.setTextColor(INK);
  doc.setDrawColor(INK);

  // Outer card
  const cardTop = 22;
  doc.setLineWidth(0.7);
  doc.rect(M - 6, cardTop, W + 12, 132);

  // Title
  let y = cardTop + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("RELATÓRIO DE SERVIÇO DE CAMPO", M + W / 2, y, { align: "center" });

  // Nome / Mês, each on a dotted rule
  y += 13;
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([0.6, 0.9], 0);

  const labelledLine = (label: string, value: string, lineStart: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(label, M, y);
    doc.line(lineStart, y + 1.2, R, y + 1.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    if (value) doc.text(value, lineStart + 2, y);
  };

  labelledLine("Nome:", report.name, M + 20);
  y += 10;
  labelledLine("Mês:", report.monthLabel, M + 17);
  doc.setLineDashPattern([], 0);

  // Table
  y += 12;
  doc.setLineWidth(0.5);

  const row = (height: number, draw: (top: number) => void, value: string, boxed = false) => {
    doc.rect(M, y, W, height);
    doc.line(colX, y, colX, y + height);
    // Value cell shading
    doc.setFillColor(...FILL);
    doc.rect(colX + 0.25, y + 0.25, valueColW - 0.5, height - 0.5, "F");
    doc.setDrawColor(INK);
    draw(y);
    if (boxed) {
      // Participation checkbox, ticked
      doc.setLineWidth(0.4);
      doc.rect(colX + valueColW / 2 - 3.5, y + height / 2 - 3.5, 7, 7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("X", colX + valueColW / 2, y + height / 2 + 2, { align: "center" });
      doc.setLineWidth(0.5);
    } else if (value) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(value, colX + valueColW / 2, y + height / 2 + 2, { align: "center" });
    }
    y += height;
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  row(16, (top) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Marque se você participou em alguma", M + 3, top + 6.5);
    doc.text("modalidade do ministério durante o mês.", M + 3, top + 11.5);
  }, "", true);

  row(12, (top) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Estudos bíblicos", M + 3, top + 7.5);
  }, String(report.bibleStudies));

  // The official form asks for whole hours.
  const wholeHours = Math.floor(report.totalMinutes / 60);
  row(16, (top) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Horas (se for pioneiro auxiliar, regular, especial", M + 3, top + 6.5);
    doc.text("ou missionário em campo)", M + 3, top + 11.5);
  }, String(wholeHours));

  // Observações
  y += 8;
  const notesH = 26;
  doc.rect(M, y, W, notesH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Observações:", M + 3, y + 6);
  if (report.notes.trim()) {
    const lines = doc.splitTextToSize(report.notes.trim(), W - 8);
    doc.text(lines.slice(0, 4), M + 3, y + 12);
  }

  // Footer
  doc.setFontSize(8);
  doc.text("S-4-T   11/23", M - 6, cardTop + 138);

  return doc;
}

export function reportFileName(monthLabel: string): string {
  return `relatorio-campo-${monthLabel.toLowerCase().replace(/\s+/g, "-")}.pdf`;
}

export function generateFieldServicePdf(report: FieldReportData): void {
  buildFieldServicePdf(report).save(reportFileName(report.monthLabel));
}
