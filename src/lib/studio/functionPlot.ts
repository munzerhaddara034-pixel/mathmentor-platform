import type { GraphPayload } from "./timeline";

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

export function compileFunction(expression: string): CompiledFn {
  const trimmed = expression.trim();
  if (!trimmed) {
    return () => Number.NaN;
  }
  const normalized = trimmed
    .replace(/\^/g, "**")
    .replace(/\be\b/g, "Math.E")
    .replace(/\bpi\b/gi, "Math.PI")
    .replace(/\bexp\s*\(/gi, "Math.exp(")
    .replace(/\bln\s*\(/gi, "Math.log(")
    .replace(/\blog\s*\(/gi, "Math.log(")
    .replace(/\bsin\s*\(/gi, "Math.sin(")
    .replace(/\bcos\s*\(/gi, "Math.cos(")
    .replace(/\btan\s*\(/gi, "Math.tan(")
    .replace(/\babs\s*\(/gi, "Math.abs(")
    .replace(/\bsqrt\s*\(/gi, "Math.sqrt(");

  try {
    // Limited math scope — expressions come from teacher-authored lesson JSON.
    const body = `"use strict"; const { abs, exp, log, sin, cos, tan, sqrt, pow, E, PI } = Math; return (${normalized});`;
    const fn = new Function("x", body) as CompiledFn;
    return (x: number) => {
      const y = fn(x);
      return typeof y === "number" && Number.isFinite(y) ? y : Number.NaN;
    };
  } catch {
    return () => Number.NaN;
  }
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

export function defaultGraphTitle(spec: GraphPayload): { ar: string; en: string } {
  if (spec.title) return spec.title;
  if (spec.kind === "argand") {
    return { ar: "المستوى العقدي", en: "Argand plane" };
  }
  return { ar: spec.fn ? `y = ${spec.fn}` : "الرسم", en: spec.fn ? `y = ${spec.fn}` : "Graph" };
}
