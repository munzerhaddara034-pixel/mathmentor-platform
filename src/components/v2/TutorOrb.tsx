import type { CSSProperties } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/**
 * «الدكتور محمد · مساعد منذر» AI-tutor orb. Pure CSS (radial + conic gradients), server-renderable, no JS.
 * `rings` adds the orbit rings used by the hero; every loop stops under prefers-reduced-motion (v2.css).
 */
export function TutorOrb({
  size,
  state = "idle",
  rings = false,
  mini = false,
  className,
}: {
  /** px; omit to size it from CSS (`--orb` on a parent). */
  size?: number;
  state?: OrbState;
  rings?: boolean;
  mini?: boolean;
  className?: string;
}) {
  if (mini) return <span className={`v2-orb is-mini${className ? ` ${className}` : ""}`} data-state={state} aria-hidden="true" />;
  const style = size ? ({ "--orb": `${size}px` } as CSSProperties) : undefined;
  return (
    <div className={`v2-orb-wrap${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      {rings ? (
        <>
          <span className="v2-ring" style={{ inset: "calc(var(--orb, 170px) * -0.22)" }} />
          <span className="v2-ring dashed" style={{ inset: "calc(var(--orb, 170px) * -0.42)" }}>
            <span className="sat" />
          </span>
        </>
      ) : null}
      <span className="v2-orb" data-state={state} />
    </div>
  );
}
