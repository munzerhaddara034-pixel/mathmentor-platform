/** Numeric core of the CAS check: mathjs evaluation to complex numbers, tolerant comparison. */
import { all, create, type MathNode } from "mathjs";

const math = create(all, {});

export type Cx = { re: number; im: number };
export type Scope = Record<string, number>;

/** Normalise model-written ASCII math: unicode minus, ln, ∞, decimal comma "2,5" stays a list separator. */
export function normalizeExpr(expr: string): string {
  return expr
    .replace(/[−–]/g, "-")
    .replace(/×|·/g, "*")
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi")
    .replace(/\bln\s*\(/g, "log(")
    .replace(/[∞]|\binfinity\b/gi, "Infinity")
    .replace(/\binf\b/gi, "Infinity")
    .replace(/\*\*/g, "^")
    .trim();
}

function toCx(value: unknown): Cx | null {
  if (typeof value === "number") return { re: value, im: 0 };
  if (typeof value === "boolean") return null;
  if (math.isComplex(value)) return { re: value.re, im: value.im };
  if (math.isBigNumber(value) || math.isFraction(value)) return { re: Number(value.valueOf()), im: 0 };
  return null;
}

/** Evaluate to a complex number; null when unparseable or non-numeric. */
export function evalCx(expr: string, scope: Scope = {}): Cx | null {
  try {
    return toCx(math.evaluate(normalizeExpr(expr), { ...scope }));
  } catch {
    return null;
  }
}

export function evalReal(expr: string, scope: Scope = {}): number | null {
  const value = evalCx(expr, scope);
  if (!value || Math.abs(value.im) > 1e-9 * Math.max(1, Math.abs(value.re))) return null;
  return value.re;
}

export function approxEqual(a: Cx, b: Cx, rel = 1e-6): boolean {
  if (!Number.isFinite(a.re) || !Number.isFinite(b.re)) return a.re === b.re && Math.abs(a.im - b.im) < 1e-9;
  const scale = Math.max(1, Math.hypot(a.re, a.im), Math.hypot(b.re, b.im));
  return Math.hypot(a.re - b.re, a.im - b.im) <= rel * scale;
}

/** Compiled real function of one variable (x ↦ number), or null when unparseable. */
export function compileFn(expr: string, variable: string): ((x: number) => number) | null {
  try {
    const compiled = math.parse(normalizeExpr(expr)).compile();
    return (x: number) => {
      const out = toCx(compiled.evaluate({ [variable]: x }));
      return out && Math.abs(out.im) < 1e-9 * Math.max(1, Math.abs(out.re)) ? out.re : Number.NaN;
    };
  } catch {
    return null;
  }
}

/** Symbolic derivative (mathjs), returned as an expression string. */
export function derivativeExpr(expr: string, variable: string): string | null {
  try {
    const node: MathNode = math.derivative(normalizeExpr(expr), variable);
    return node.toString();
  } catch {
    return null;
  }
}

/** Composite Simpson rule on [a, b]. */
export function simpson(fn: (x: number) => number, a: number, b: number, n = 2000): number {
  const steps = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / steps;
  let sum = fn(a) + fn(b);
  for (let i = 1; i < steps; i++) sum += fn(a + i * h) * (i % 2 === 0 ? 2 : 4);
  return (sum * h) / 3;
}
