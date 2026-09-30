import type { CSSProperties, ReactNode } from "react";

/**
 * Staggered fade-up for solver thread items. Pure CSS (`.v2-reveal`, delay from `--i`) so the result page
 * ships no motion JS; static under prefers-reduced-motion. Framer is kept for the live solver chat only.
 */
export function Reveal({ index = 0, children, className }: { index?: number; children: ReactNode; className?: string }) {
  return (
    <div className={`v2-reveal${className ? ` ${className}` : ""}`} style={{ "--i": index } as CSSProperties}>
      {children}
    </div>
  );
}
