/** Calculus checks: ODE + initial conditions, definite integrals, limits, derivatives, roots, identities. */
import type { CheckOutcome, Claim } from "./claims.ts";
import { approxEqual, compileFn, derivativeExpr, evalCx, evalReal, simpson } from "./numeric.ts";

const SAMPLE_POINTS = [-0.9, -0.3, 0.2, 0.7, 1.3];

function relClose(a: number, b: number, rel = 1e-6): boolean {
  return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
}

export function checkOde(claim: Extract<Claim, { kind: "ode" }>): CheckOutcome {
  const v = claim.variable;
  const d1 = derivativeExpr(claim.solution, v);
  const d2 = d1 ? derivativeExpr(d1, v) : null;
  const d3 = d2 ? derivativeExpr(d2, v) : null;
  const y = [claim.solution, d1, d2, d3];
  const fns = y.map((expr) => (expr ? compileFn(expr, v) : null));
  if (!fns[0] || !fns[1] || !fns[2]) return { kind: claim.kind, status: "skipped", detail: "cannot differentiate the solution" };
  for (const x of SAMPLE_POINTS) {
    const scope: Record<string, number> = { [v]: x, y0: fns[0](x), y1: fns[1](x), y2: fns[2](x), y3: fns[3] ? fns[3](x) : Number.NaN };
    const lhs = evalReal(claim.lhs, scope);
    const rhs = evalReal(claim.rhs, scope);
    if (lhs === null || rhs === null) return { kind: claim.kind, status: "skipped", detail: "cannot evaluate the equation" };
    if (!relClose(lhs, rhs, 1e-6)) {
      return { kind: claim.kind, status: "fail", detail: `y = ${claim.solution} does not satisfy the equation at ${v} = ${x} (${lhs.toFixed(6)} ≠ ${rhs.toFixed(6)})` };
    }
  }
  for (const condition of claim.conditions) {
    const fn = fns[condition.order];
    const at = evalReal(condition.at);
    const expected = evalReal(condition.value);
    if (!fn || at === null || expected === null) return { kind: claim.kind, status: "skipped", detail: "cannot evaluate an initial condition" };
    const got = fn(at);
    if (!relClose(got, expected, 1e-6)) {
      const name = condition.order === 0 ? "y" : `y${"'".repeat(condition.order)}`;
      return { kind: claim.kind, status: "fail", detail: `${name}(${condition.at}) = ${got.toFixed(6)} but the condition requires ${condition.value}` };
    }
  }
  return { kind: claim.kind, status: "pass", detail: `y satisfies the equation and ${claim.conditions.length} condition(s)` };
}

export function checkIntegral(claim: Extract<Claim, { kind: "integral" }>): CheckOutcome {
  const fn = compileFn(claim.integrand, claim.variable);
  const a = evalReal(claim.lower);
  const b = evalReal(claim.upper);
  const expected = evalReal(claim.value);
  if (!fn || a === null || b === null || expected === null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return { kind: claim.kind, status: "skipped", detail: "integral not numerically parseable" };
  }
  const got = simpson(fn, a, b);
  if (!Number.isFinite(got)) return { kind: claim.kind, status: "skipped", detail: "integrand not finite on the interval" };
  return relClose(got, expected, 1e-5)
    ? { kind: claim.kind, status: "pass", detail: `∫ = ${got.toFixed(6)} matches ${claim.value}` }
    : { kind: claim.kind, status: "fail", detail: `numeric ∫ = ${got.toFixed(6)} ≠ claimed ${claim.value} (${expected.toFixed(6)})` };
}

function limitSamples(to: number): number[] {
  if (to === Number.POSITIVE_INFINITY) return [50, 100, 200, 400];
  if (to === Number.NEGATIVE_INFINITY) return [-50, -100, -200, -400];
  return [1e-3, 1e-4, 1e-5, 1e-6].flatMap((h) => [to - h, to + h]);
}

export function checkLimit(claim: Extract<Claim, { kind: "limit" }>): CheckOutcome {
  const fn = compileFn(claim.expr, claim.variable);
  const to = evalReal(claim.to);
  const expected = evalReal(claim.value);
  if (!fn || to === null || expected === null) return { kind: claim.kind, status: "skipped", detail: "limit not parseable" };
  const values = limitSamples(to).map(fn).filter((value) => !Number.isNaN(value));
  if (values.length < 2) return { kind: claim.kind, status: "skipped", detail: "function undefined near the point" };
  const last = values[values.length - 1];
  let ok: boolean;
  if (expected === Number.POSITIVE_INFINITY) ok = last > 1e6;
  else if (expected === Number.NEGATIVE_INFINITY) ok = last < -1e6;
  else ok = Math.abs(last - expected) <= 1e-3 * Math.max(1, Math.abs(expected));
  return ok
    ? { kind: claim.kind, status: "pass", detail: `f → ${claim.value} (sample ${last.toPrecision(4)})` }
    : { kind: claim.kind, status: "fail", detail: `numeric samples approach ${last.toPrecision(6)}, not ${claim.value}` };
}

export function checkDerivative(claim: Extract<Claim, { kind: "derivative" }>): CheckOutcome {
  const exact = derivativeExpr(claim.fn, claim.variable);
  const mine = exact ? compileFn(exact, claim.variable) : null;
  const theirs = compileFn(claim.derivative, claim.variable);
  if (!mine || !theirs) return { kind: claim.kind, status: "skipped", detail: "derivative not parseable" };
  for (const x of SAMPLE_POINTS) {
    if (!relClose(mine(x), theirs(x), 1e-6)) {
      return { kind: claim.kind, status: "fail", detail: `d/d${claim.variable} ${claim.fn} = ${exact}, not ${claim.derivative}` };
    }
  }
  return { kind: claim.kind, status: "pass", detail: "derivative confirmed symbolically" };
}

export function checkRoot(claim: Extract<Claim, { kind: "root" }>): CheckOutcome {
  const fn = compileFn(claim.expr, claim.variable);
  const x = evalReal(claim.value);
  if (!fn || x === null) return { kind: claim.kind, status: "skipped", detail: "root not parseable" };
  const lo = claim.lower !== undefined ? evalReal(claim.lower) : null;
  const hi = claim.upper !== undefined ? evalReal(claim.upper) : null;
  if (lo !== null && hi !== null) {
    if (!(lo < x && x < hi)) return { kind: claim.kind, status: "fail", detail: `${claim.value} is not inside ]${claim.lower}, ${claim.upper}[` };
    if (!(fn(lo) * fn(hi) < 0)) return { kind: claim.kind, status: "fail", detail: `no sign change on [${claim.lower}, ${claim.upper}]` };
  }
  const slope = Math.abs(fn(x + 1e-4) - fn(x - 1e-4)) / 2e-4;
  const tolerance = Math.max(1e-6, slope * 5e-3);
  return Math.abs(fn(x)) <= tolerance
    ? { kind: claim.kind, status: "pass", detail: `f(${claim.value}) ≈ ${fn(x).toExponential(2)}` }
    : { kind: claim.kind, status: "fail", detail: `f(${claim.value}) = ${fn(x).toFixed(6)} ≠ 0` };
}

export function checkEqual(claim: Extract<Claim, { kind: "equal" }>): CheckOutcome {
  const points = claim.variable ? SAMPLE_POINTS : [0];
  for (const x of points) {
    const scope = claim.variable ? { [claim.variable]: x } : {};
    const left = evalCx(claim.left, scope);
    const right = evalCx(claim.right, scope);
    if (!left || !right) return { kind: claim.kind, status: "skipped", detail: "identity not parseable" };
    if (!approxEqual(left, right, 1e-6)) {
      return { kind: claim.kind, status: "fail", detail: `${claim.left} = ${left.re.toFixed(6)}${left.im ? ` + ${left.im.toFixed(6)}i` : ""} ≠ ${claim.right}` };
    }
  }
  return { kind: claim.kind, status: "pass", detail: `${claim.left} = ${claim.right}` };
}
