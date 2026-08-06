/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extracts keyword frequencies from task text (PT-BR stop words filtered).
 * Pure, in-memory, no I/O.
 */

import { Task } from "../types";

const STOP_WORDS_PT = new Set([
  "a","ao","aos","as","com","da","das","de","do","dos","e","em",
  "é","eu","foi","já","mas","me","mesmo","meu","minha","na","nas",
  "no","nos","num","o","os","ou","para","pela","pelo","pelos","pelas",
  "por","que","se","sem","ser","só","sua","suas","também","tem","ter",
  "toda","todas","todo","todos","um","uma","umas","uns","vai","vou",
  "não","mais","muito","quando","como","isso","esse","esta","este",
  "ela","ele","eles","elas","aqui","ali","hoje","até","depois","antes",
  "durante","fazer","fiz","fui","tenho","tinha","quero","preciso",
  "ir","ver","dar","saber","ainda","apenas","pois","então","assim",
]);

export function extractKeywords(tasks: Task[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const task of tasks) {
    const words = task.text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip accents
      .replace(/[^a-z0-9\s]/g, " ")    // strip punctuation
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS_PT.has(w));
    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return freq;
}

export function getTopKeywords(
  freq: Map<string, number>,
  limit = 8
): Array<{ keyword: string; count: number }> {
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}
