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

/**
 * Paper texture shader configuration. Maps 1:1 to @paper-design/shaders-react
 * PaperTexture props, plus an `overlayOpacity` controlling the wrapper opacity
 * (the layer that is composited on top of the post-it background color).
 */
export interface PaperTextureConfig {
  colorBack: string;
  colorFront: string;
  contrast: number;
  roughness: number;
  fiber: number;
  fiberSize: number;
  crumples: number;
  crumpleSize: number;
  folds: number;
  foldCount: number;
  fade: number;
  drops: number;
  seed: number;
  scale: number;
  overlayOpacity: number; // 0..1 — wrapper opacity (texture intensity)
}

export interface Palette {
  id: PaletteId;
  name: string;
  colors: PaletteColor[]; // exactly 5
  texture: PaperTextureConfig;
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
    ],
    // Clean, soft paper. Subtle noise, almost no crumples.
    texture: {
      colorBack: "#ffffff",
      colorFront: "#9fadbc",
      contrast: 0.30,
      roughness: 0.35,
      fiber: 0.30,
      fiberSize: 0.20,
      crumples: 0.18,
      crumpleSize: 0.35,
      folds: 0.35,
      foldCount: 3,
      fade: 0,
      drops: 0.10,
      seed: 6,
      scale: 0.60,
      overlayOpacity: 0.40
    }
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
    ],
    // Almost flat — vibrant colors pop more on clean paper.
    texture: {
      colorBack: "#ffffff",
      colorFront: "#d8d2cb",
      contrast: 0.30,
      roughness: 0.20,
      fiber: 0.15,
      fiberSize: 0.30,
      crumples: 0.10,
      crumpleSize: 0.50,
      folds: 0.15,
      foldCount: 2,
      fade: 0,
      drops: 0.05,
      seed: 11,
      scale: 0.70,
      overlayOpacity: 0.22
    }
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
    ],
    // Clean, slight variation — like fresh glossy paper.
    texture: {
      colorBack: "#ffffff",
      colorFront: "#c4c0bd",
      contrast: 0.30,
      roughness: 0.28,
      fiber: 0.20,
      fiberSize: 0.20,
      crumples: 0.15,
      crumpleSize: 0.30,
      folds: 0.25,
      foldCount: 3,
      fade: 0,
      drops: 0.10,
      seed: 17,
      scale: 0.60,
      overlayOpacity: 0.28
    }
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
    ],
    // Heavy, warm, weathered — sun-baked paper feel.
    texture: {
      colorBack: "#ffffff",
      colorFront: "#8b5a3c",
      contrast: 0.45,
      roughness: 0.55,
      fiber: 0.50,
      fiberSize: 0.25,
      crumples: 0.48,
      crumpleSize: 0.30,
      folds: 0.70,
      foldCount: 7,
      fade: 0.10,
      drops: 0.28,
      seed: 23,
      scale: 0.55,
      overlayOpacity: 0.55
    }
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
    ],
    // Paper-bag / urban grit — heavy folds and crumples.
    texture: {
      colorBack: "#ffffff",
      colorFront: "#6c6c6c",
      contrast: 0.40,
      roughness: 0.55,
      fiber: 0.40,
      fiberSize: 0.18,
      crumples: 0.42,
      crumpleSize: 0.25,
      folds: 0.78,
      foldCount: 8,
      fade: 0.15,
      drops: 0.35,
      seed: 31,
      scale: 0.50,
      overlayOpacity: 0.60
    }
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
    ],
    // Aged kraft paper — earthy, fibrous, with character.
    texture: {
      colorBack: "#ffffff",
      colorFront: "#6b5a44",
      contrast: 0.40,
      roughness: 0.50,
      fiber: 0.55,
      fiberSize: 0.30,
      crumples: 0.38,
      crumpleSize: 0.40,
      folds: 0.55,
      foldCount: 5,
      fade: 0.10,
      drops: 0.32,
      seed: 41,
      scale: 0.65,
      overlayOpacity: 0.50
    }
  }
];

export const DEFAULT_PALETTE_ID: PaletteId = "pastel";

export function getPaletteById(id: string | undefined): Palette {
  return PALETTES.find((p) => p.id === id) || PALETTES[0];
}
