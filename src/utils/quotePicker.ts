/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motivational quote picker for the SOS modal. Avoids showing the same
 * quote twice in a row.
 */

import quotes from "../constants/quotes.json";

export interface Quote {
  text: string;
  author: string;
  source: string;
}

const ALL = quotes as Quote[];
let lastIndex: number | null = null;

export function getRandomQuote(): Quote {
  if (ALL.length === 0) return { text: "", author: "", source: "" };
  if (ALL.length === 1) return ALL[0];
  let idx: number;
  do {
    idx = Math.floor(Math.random() * ALL.length);
  } while (idx === lastIndex);
  lastIndex = idx;
  return ALL[idx];
}
