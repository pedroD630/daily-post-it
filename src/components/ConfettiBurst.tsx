/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dependency-free confetti burst rendered with motion/react.
 * Mounts ~28 paper squares at the origin point and flings them outward with
 * randomized angle, distance, rotation and fall. Auto-clears after ~1.6s.
 *
 * Trigger by bumping the `burst` counter prop (0 = never fired).
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

const CONFETTI_COLORS = [
  "#f59e0b", "#ef4444", "#3b82f6", "#10b981",
  "#a855f7", "#ec4899", "#facc15", "#06b6d4",
];

interface Particle {
  id: number;
  color: string;
  x: number;       // final horizontal offset (px)
  y: number;       // final vertical offset (px)
  rotate: number;  // final rotation (deg)
  size: number;    // px
  delay: number;   // s
  isCircle: boolean;
}

function makeParticles(seed: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 28; i++) {
    const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.5;
    const distance = 70 + Math.random() * 130;
    particles.push({
      id: seed * 100 + i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      x: Math.cos(angle) * distance,
      // Bias downward slightly so it reads as falling paper
      y: Math.sin(angle) * distance * 0.7 + 40 + Math.random() * 60,
      rotate: (Math.random() - 0.5) * 720,
      size: 5 + Math.random() * 6,
      delay: Math.random() * 0.12,
      isCircle: Math.random() > 0.6,
    });
  }
  return particles;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ConfettiBurst({ burst }: { burst: number }) {
  const [active, setActive] = useState(false);
  const reduced = useMemo(prefersReducedMotion, []);

  useEffect(() => {
    if (burst <= 0 || reduced) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 1600);
    return () => clearTimeout(t);
  }, [burst, reduced]);

  const particles = useMemo(() => makeParticles(burst), [burst]);

  // Respect the OS "reduce motion" setting — no flying particles.
  if (reduced || !active) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-30 pointer-events-none overflow-visible flex items-center justify-center"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: -10, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate, scale: 0.6 }}
          transition={{ duration: 1.3, delay: p.delay, ease: [0.12, 0.6, 0.35, 1] }}
          className="absolute"
          style={{
            width: p.size,
            height: p.size * (p.isCircle ? 1 : 0.6),
            backgroundColor: p.color,
            borderRadius: p.isCircle ? "50%" : "1px",
          }}
        />
      ))}
    </div>
  );
}
