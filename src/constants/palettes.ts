/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaletteId =
  | "pastel"
  | "vivid"
  | "happy"
  | "marrakesh"
  | "newyork"
  | "belohorizonte";

export interface PaletteColor {
  name: string;
  hex: string;
}

export interface Palette {
  id: PaletteId;
  name: string;
  colors: PaletteColor[]; // exactly 5
}

export const PALETTES: Palette[] = [
  {
    id: "pastel",
    name: "Pastel",
    colors: [
      { name: "Yellow", hex: "#FFEB3B" },
      { name: "Green",  hex: "#69F0AE" },
      { name: "Blue",   hex: "#40C4FF" },
      { name: "Orange", hex: "#FF6E40" },
      { name: "Pink",   hex: "#F48FB1" }
    ]
  },
  {
    id: "vivid",
    name: "Vivid",
    colors: [
      { name: "Hot Pink",     hex: "#ff7eb9" },
      { name: "Pink",         hex: "#ff65a3" },
      { name: "Cyan",         hex: "#7afcff" },
      { name: "Pale Yellow",  hex: "#feff9c" },
      { name: "Yellow",       hex: "#fff740" }
    ]
  },
  {
    id: "happy",
    name: "Happy",
    colors: [
      { name: "Turquoise", hex: "#00ced1" },
      { name: "Orange",    hex: "#ff6700" },
      { name: "Magenta",   hex: "#ff24a9" },
      { name: "Yellow",    hex: "#ffe700" },
      { name: "White",     hex: "#ffffff" }
    ]
  },
  {
    id: "marrakesh",
    name: "Marrakesh",
    colors: [
      { name: "Coral",   hex: "#ee5f35" },
      { name: "Saffron", hex: "#f8bd49" },
      { name: "Lime",    hex: "#e7df34" },
      { name: "Sky",     hex: "#86a6d5" },
      { name: "Purple",  hex: "#a2509a" }
    ]
  },
  {
    id: "newyork",
    name: "New York",
    colors: [
      { name: "Taxi",     hex: "#ffd938" },
      { name: "Concrete", hex: "#90909a" },
      { name: "Stone",    hex: "#d6d4df" },
      { name: "Sky",      hex: "#b3cce2" },
      { name: "Liberty",  hex: "#1dace6" }
    ]
  },
  {
    id: "belohorizonte",
    name: "Belo Horizonte",
    colors: [
      { name: "Sky",         hex: "#5B8DB8" },
      { name: "Beige",       hex: "#D8C7B0" },
      { name: "Sage",        hex: "#5E6F52" },
      { name: "Terracotta",  hex: "#A65E3B" },
      { name: "Sun",         hex: "#E5B85C" }
    ]
  }
];

export const DEFAULT_PALETTE_ID: PaletteId = "pastel";

export function getPaletteById(id: string | undefined): Palette {
  return PALETTES.find((p) => p.id === id) || PALETTES[0];
}
