/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Memoized wrapper around @paper-design/shaders-react PaperTexture.
 *
 * Implementation notes:
 *  - PaperTexture renders a <div> that holds the WebGL canvas. The shaders
 *    library reads that div's size via ResizeObserver to size the canvas.
 *    Per the package README, dimensions must be passed via the `style` prop
 *    (e.g. `style={{ width: 200, height: 200 }}`) — NOT as `width="100%"`
 *    props at the top level, which the library treats as inline CSS but
 *    in some flex/absolute contexts collapses to 0×0.
 *  - We absolutely-position PaperTexture's own div to inset:0 inside the
 *    post-it card, applying mix-blend-mode and opacity directly on it.
 *    No extra wrapper, no missed layout pass.
 *  - React.memo: palette configs come from a constant module, so the
 *    `config` reference is stable. We avoid re-creating the WebGL canvas
 *    on every parent re-render.
 *  - Respect prefers-reduced-motion and tame mobile pixel-ratio for perf.
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
  const isMobile = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { isMobile, reducedMotion };
}

function PostItPaperTextureInner({ config }: Props) {
  const env = useMemo(detectEnv, []);

  if (env.reducedMotion) return null;

  const minPixelRatio = env.isMobile ? 1 : 2;
  const maxPixelCount = env.isMobile ? 600 * 600 : 1280 * 1280;

  return (
    <PaperTexture
      aria-hidden="true"
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
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        borderRadius: "inherit",
        mixBlendMode: "multiply",
        opacity: config.overlayOpacity,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    />
  );
}

export const PostItPaperTexture = memo(PostItPaperTextureInner);
