"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Framer Motion, solver routes only: LazyMotion + domAnimation (≈ 15 KB) with `strict` so only the
 * lightweight `m.*` components can be used. `reducedMotion="user"` honours prefers-reduced-motion.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
