/** Linear algebra checks: systems by substitution, eigenpairs, P D P^{-1} factorisations. */
import type { CheckOutcome, Claim } from "./claims.ts";
import { approxEqual, evalCx, evalReal } from "./numeric.ts";

type Mat = number[][];

function toMatrix(rows: string[][]): Mat | null {
  const out: Mat = [];
  for (const row of rows) {
    const nums = row.map((cell) => evalReal(cell));
    if (nums.some((value) => value === null)) return null;
    out.push(nums as number[]);
  }
  const width = out[0]?.length ?? 0;
  return width > 0 && out.every((row) => row.length === width) ? out : null;
}

function mul(a: Mat, b: Mat): Mat {
  return a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
}

function det(m: Mat): number {
  const a = m.map((row) => [...row]);
  const n = a.length;
  let result = 1;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return 0;
    if (pivot !== col) {
      [a[pivot], a[col]] = [a[col], a[pivot]];
      result = -result;
    }
    result *= a[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = a[r][col] / a[col][col];
      for (let c = col; c < n; c++) a[r][c] -= factor * a[col][c];
    }
  }
  return result;
}

const close = (a: Mat, b: Mat) =>
  a.length === b.length && a.every((row, i) => row.every((value, j) => Math.abs(value - b[i][j]) <= 1e-6 * Math.max(1, Math.abs(value))));

const fmt = (m: Mat) => `[${m.map((row) => `[${row.map((v) => +v.toFixed(6)).join(", ")}]`).join(", ")}]`;

export function checkLinearSystem(claim: Extract<Claim, { kind: "linear_system" }>): CheckOutcome {
  const scope: Record<string, number> = {};
  for (const [name, value] of Object.entries(claim.solution)) {
    const num = evalReal(value);
    if (num === null) return { kind: claim.kind, status: "skipped", detail: `non-numeric value for ${name}` };
    scope[name] = num;
  }
  for (const equation of claim.equations) {
    const [lhs, rhs, extra] = equation.split("=");
    if (!lhs || rhs === undefined || extra !== undefined) return { kind: claim.kind, status: "skipped", detail: `cannot parse "${equation}"` };
    const left = evalCx(lhs, scope);
    const right = evalCx(rhs, scope);
    if (!left || !right) return { kind: claim.kind, status: "skipped", detail: `cannot evaluate "${equation}"` };
    if (!approxEqual(left, right)) {
      return { kind: claim.kind, status: "fail", detail: `${equation} is false for ${JSON.stringify(claim.solution)} (${left.re} ≠ ${right.re})` };
    }
  }
  return { kind: claim.kind, status: "pass", detail: `solution satisfies all ${claim.equations.length} equations` };
}

export function checkEigenpair(claim: Extract<Claim, { kind: "eigenpair" }>): CheckOutcome {
  const a = toMatrix(claim.matrix);
  const lambda = evalReal(claim.value);
  const v = claim.vector.map((cell) => evalReal(cell));
  if (!a || lambda === null || v.some((value) => value === null)) return { kind: claim.kind, status: "skipped", detail: "non-numeric matrix/eigenpair" };
  const vec = v as number[];
  if (vec.length !== a.length || vec.every((value) => Math.abs(value) < 1e-12)) {
    return { kind: claim.kind, status: "fail", detail: "eigenvector must be a non-zero vector of the right size" };
  }
  const av = a.map((row) => row.reduce((sum, value, k) => sum + value * vec[k], 0));
  const ok = av.every((value, i) => Math.abs(value - lambda * vec[i]) <= 1e-6 * Math.max(1, Math.abs(value)));
  const shifted = a.map((row, i) => row.map((value, j) => value - (i === j ? lambda : 0)));
  const singular = Math.abs(det(shifted)) < 1e-6;
  if (!singular) return { kind: claim.kind, status: "fail", detail: `λ = ${lambda} is not an eigenvalue: det(A − λI) = ${det(shifted).toFixed(4)}` };
  return ok
    ? { kind: claim.kind, status: "pass", detail: `A·v = ${lambda}·v for v = (${vec.join(", ")})` }
    : { kind: claim.kind, status: "fail", detail: `A·v = (${av.map((x) => +x.toFixed(6)).join(", ")}) ≠ ${lambda}·(${vec.join(", ")})` };
}

export function checkDiagonalization(claim: Extract<Claim, { kind: "diagonalization" }>): CheckOutcome {
  const a = toMatrix(claim.matrix);
  const p = toMatrix(claim.P);
  const d = toMatrix(claim.D);
  if (!a || !p || !d) return { kind: claim.kind, status: "skipped", detail: "non-numeric matrices" };
  if (p.length !== a.length || d.length !== a.length) return { kind: claim.kind, status: "fail", detail: "size mismatch" };
  if (!d.every((row, i) => row.every((value, j) => i === j || Math.abs(value) < 1e-12))) {
    return { kind: claim.kind, status: "fail", detail: "D is not diagonal" };
  }
  if (Math.abs(det(p)) < 1e-9) return { kind: claim.kind, status: "fail", detail: "P is not invertible (det P = 0)" };
  const ap = mul(a, p);
  const pd = mul(p, d);
  return close(ap, pd)
    ? { kind: claim.kind, status: "pass", detail: "A·P = P·D and det P ≠ 0" }
    : { kind: claim.kind, status: "fail", detail: `A·P = ${fmt(ap)} ≠ P·D = ${fmt(pd)}` };
}

/** Matrices written in the statement as [[a, b], [c, d]] (rows). */
export function matricesInText(text: string): Mat[] {
  const found: Mat[] = [];
  const pattern = /\[\s*\[[^\[\]]+\](?:\s*,\s*\[[^\[\]]+\])+\s*\]/g;
  for (const match of text.replace(/[−–]/g, "-").matchAll(pattern)) {
    const rows = [...match[0].matchAll(/\[([^\[\]]+)\]/g)].map((row) => row[1].split(",").map((cell) => cell.trim()));
    const mat = toMatrix(rows);
    if (mat) found.push(mat);
  }
  return found;
}

/** Guard against a mistranscribed matrix: every claimed matrix must equal one in the statement. */
export function checkMatricesAgainstQuestion(question: string, claims: Claim[]): CheckOutcome[] {
  const stated = matricesInText(question);
  if (!stated.length) return [];
  const out: CheckOutcome[] = [];
  for (const claim of claims) {
    if (claim.kind !== "eigenpair" && claim.kind !== "diagonalization") continue;
    const m = toMatrix(claim.matrix);
    if (!m) continue;
    const same = stated.some((s) => s.length === m.length && close(s, m));
    if (!same) out.push({ kind: "question_matrix", status: "fail", detail: `matrix ${fmt(m)} differs from the statement` });
  }
  return out;
}

