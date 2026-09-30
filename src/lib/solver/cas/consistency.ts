/**
 * Final box vs steps: every "label = value" in finalAnswerLatex must agree numerically with the
 * last value the steps gave for the same label (catches z^6 = -64 in the box vs 64 in the steps).
 */
import type { CheckOutcome } from "./claims.ts";
import { latexToExpr } from "./latexExpr.ts";
import { approxEqual, evalCx } from "./numeric.ts";

function stripWrappers(tex: string): string {
  return tex
    .replace(/\\boxed\s*\{([\s\S]*)\}/g, "$1")
    .replace(/\\begin\{(?:array|aligned|cases|gathered)\}(?:\{[^{}]*\})?|\\end\{(?:array|aligned|cases|gathered)\}/g, "\n")
    .replace(/&/g, " ");
}

function normalizeLabel(label: string): string {
  return label
    .replace(/\\text\s*\{[^{}]*\}|\\left|\\right|\\[,;!]|\s|[{}]/g, "")
    .replace(/^\d+\)|^[a-z]\)/, "")
    .trim();
}

/** label → last right-hand side, from segments like "A = … = 11\\sqrt{2}". */
export function equalities(tex: string): Map<string, string> {
  const out = new Map<string, string>();
  const segments = stripWrappers(tex).split(/\\\\|\n|;|,\s*(?:\\quad|\\qquad)|\\quad|\\qquad|\\text\s*\{\s*(?:and|et|و)\s*\}/);
  for (const segment of segments) {
    if (/\\(?:implies|Rightarrow|iff|approx|le|ge|neq|in)\b|[<>]/.test(segment)) continue;
    const parts = segment.split("=").map((part) => part.trim());
    if (parts.length < 2) continue;
    const label = normalizeLabel(parts[0]);
    const value = parts[parts.length - 1];
    if (label && value && label.length <= 24) out.set(label, value);
  }
  return out;
}

export function checkFinalAgainstSteps(finalLatex: string, stepLatex: string[]): CheckOutcome[] {
  const final = equalities(finalLatex);
  const fromSteps = new Map<string, string>();
  for (const latex of stepLatex) for (const [label, value] of equalities(latex)) fromSteps.set(label, value);
  const out: CheckOutcome[] = [];
  for (const [label, boxValue] of final) {
    const stepValue = fromSteps.get(label);
    if (!stepValue) continue;
    const a = latexToExpr(boxValue);
    const b = latexToExpr(stepValue);
    const x = a ? evalCx(a) : null;
    const y = b ? evalCx(b) : null;
    if (!x || !y) continue;
    if (!approxEqual(x, y, 1e-6)) {
      out.push({ kind: "final_vs_steps", status: "fail", detail: `final box has ${label} = ${boxValue} but the steps give ${label} = ${stepValue}` });
    } else {
      out.push({ kind: "final_vs_steps", status: "pass", detail: `${label} consistent` });
    }
  }
  return out;
}
