import type { GraphPayload } from "./timeline";
import { parseSafeExpression } from "@/lib/math/safeExpression";

/**
 * Lightweight function-plot engine used by the Math Canvas.
 *
 * This is a small SVG renderer (no d3 runtime) that accepts the same kind of
 * parameters as `function-plot`: `fn` in `x`, axis domains, and point overlays.
 *
 * Optional future adapters (not loaded by default):
 * - npm `function-plot` (d3-based) — swap `compileFunction` / `sampleFn` if needed
 * - GeoGebra — see `src/lib/studio/geogebra.ts`
 */
export type CompiledFn = (x: number) => number;

/**
 * Compile an expression with the safe grammar parser (`src/lib/math/safeExpression.ts`).
 *
 * Board graphs are drawn inside every participant's browser, so this deliberately avoids
 * `new Function`: anything that is not plain maths (statements, property access, calls to
 * identifiers that are not maths functions) throws and the graph is skipped instead of running.
 * `log(` keeps the historical natural-log meaning used by the authored lesson JSON.
 */
export function compileFunction(expression: string): CompiledFn {
  const normalized = expression.trim().replace(/\blog\s*\(/gi, "ln(");
  if (!normalized) return () => Number.NaN;
  let fn: (x: number) => number;
  try {
    fn = parseSafeExpression(normalized);
  } catch {
    return () => Number.NaN;
  }
  return (x: number) => {
    const y = fn(x);
    return Number.isFinite(y) ? y : Number.NaN;
  };
}

export type SampledPoint = { x: number; y: number };

export function sampleFn(
  fn: CompiledFn,
  xDomain: [number, number],
  samples = 240,
): Array<SampledPoint | null> {
  const [xMin, xMax] = xDomain;
  const span = xMax - xMin || 1;
  const out: Array<SampledPoint | null> = [];
  for (let i = 0; i <= samples; i += 1) {
    const x = xMin + (span * i) / samples;
    const y = fn(x);
    out.push(Number.isFinite(y) ? { x, y } : null);
  }
  return out;
}

export function niceDomain(values: number[], fallback: [number, number]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 2) return fallback;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

export function defaultGraphTitle(spec: GraphPayload): { en: string; fr: string } {
  if (spec.title) {
    return { en: spec.title.en, fr: spec.title.fr || spec.title.en };
  }
  if (spec.kind === "argand") {
    return { en: "Argand plane", fr: "Plan d’Argand" };
  }
  return { en: spec.fn ? `y = ${spec.fn}` : "Graph", fr: spec.fn ? `y = ${spec.fn}` : "Graphe" };
}
