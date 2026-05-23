/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Memoized wrapper around @paper-design/shaders-react PaperTexture.
 *
 * Why a dedicated component:
 *  - Holds the perf-tuning logic (mobile pixel-ratio cap, reduced-motion bypass)
 *    so PostItCard stays focused on layout.
 *  - React.memo with reference equality on the `config` object: since palette
 *    configs come from a frozen constants module (PALETTES), the reference is
 *    stable across parent re-renders. This prevents the WebGL canvas from
 *    re-initializing whenever the parent re-renders due to unrelated state.
 *  - Returns null under prefers-reduced-motion: respects user OS-level setting
 *    AND saves the cost of a WebGL context altogether for users who don't
 *    want or can't tolerate animated/heavy graphics.
 */

import { memo, useMemo } from "react";
import { PaperTexture } from "@paper-design/shaders-react";
import type { PaperTextureConfig } from "../constants/palettes";

interface Props {
  config: PaperTextureConfig;
}

function detectEnv() {
  if (typeof window === "undefined") {
    return { isMobile: false, reducedMotion: false };
  }
  // pointer:coarse is the W3C-blessed way to detect touch-first devices.
  const isMobile = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { isMobile, reducedMotion };
}

function PostItPaperTextureInner({ config }: Props) {
  // detectEnv() reads matchMedia which won't change without a page reload,
  // so a single useMemo at mount is enough — no subscriptions needed.
  const env = useMemo(detectEnv, []);

  if (env.reducedMotion) return null;

  // Mobile devices: cap effective resolution to roughly half. This is the
  // biggest single perf lever — WebGL fragment work is proportional to pixel
  // count, and a post-it card is small enough that 1x DPR looks fine.
  const minPixelRatio = env.isMobile ? 1 : 2;
  const maxPixelCount = env.isMobile ? 600 * 600 : 1280 * 1280;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        borderRadius: "inherit",
        mixBlendMode: "multiply",
        opacity: config.overlayOpacity,
      }}
    >
      <PaperTexture
        width="100%"
        height="100%"
        minPixelRatio={minPixelRatio}
        maxPixelCount={maxPixelCount}
        colorBack={config.colorBack}
        colorFront={config.colorFront}
        contrast={config.contrast}
        roughness={config.roughness}
        fiber={config.fiber}
        fiberSize={config.fiberSize}
        crumples={config.crumples}
        crumpleSize={config.crumpleSize}
        folds={config.folds}
        foldCount={config.foldCount}
        drops={config.drops}
        fade={config.fade}
        seed={config.seed}
        scale={config.scale}
        fit="cover"
      />
    </div>
  );
}

// Reference-equality on config is enough: palette configs come from a frozen
// constants module, so the reference is stable when the user doesn't change
// palette. When they do, we want a re-render anyway.
export const PostItPaperTexture = memo(PostItPaperTextureInner);
