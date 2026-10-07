#!/usr/bin/env node
/**
 * Measures the safety net: when the answer box contradicts the steps, does the platform notice?
 *
 * This is the question that matters more than raw model accuracy — a wrong answer that is flagged for
 * human review is far less damaging than a wrong answer presented as certain. It feeds the CAS /
 * consistency layer (the code that runs inside solveAndVerify) with deliberately wrong final answers
 * and reports how many are caught.
 *
 *   node --import ./tests/support/register.mjs scripts/verify-solver-catches-errors.mjs
 */
const { runCasChecks } = await import("../src/lib/solver/cas/index.ts");

const CASES = [
  {
    name: "integral, final answer contradicts the evaluated step",
    question: "Compute the integral from 0 to 1 of 3x^2 dx.",
    wrong: { finalAnswerLatex: "2", stepLatex: ["\\int_0^1 3x^2\\,dx=1"] },
    right: { finalAnswerLatex: "1", stepLatex: ["\\int_0^1 3x^2\\,dx=1"] },
  },
  {
    name: "derivative, wrong constant term in the boxed answer",
    question: "Differentiate f(x)=x^3-4x^2+7x-2.",
    wrong: { finalAnswerLatex: "3x^{2}-8x+8", stepLatex: ["f'(x)=3x^{2}-8x+7"] },
    right: { finalAnswerLatex: "3x^{2}-8x+7", stepLatex: ["f'(x)=3x^{2}-8x+7"] },
  },
  {
    name: "linear equation, boxed root differs from the solved steps",
    question: "Solve for x: 5x - 7 = 3x + 9.",
    wrong: { finalAnswerLatex: "x=9", stepLatex: ["5x-3x=9+7", "2x=16", "x=8"] },
    right: { finalAnswerLatex: "x=8", stepLatex: ["5x-3x=9+7", "2x=16", "x=8"] },
  },
  {
    name: "quadratic, one root missing from the boxed answer",
    question: "Solve x^2 - 5x + 6 = 0.",
    wrong: { finalAnswerLatex: "x=2", stepLatex: ["(x-2)(x-3)=0", "x=2 \\quad \\text{or} \\quad x=3"] },
    right: { finalAnswerLatex: "x=2 \\text{ or } x=3", stepLatex: ["(x-2)(x-3)=0", "x=2 \\quad \\text{or} \\quad x=3"] },
  },
];

function check(question, entry) {
  return runCasChecks({
    question,
    checks: [],
    finalAnswerLatex: entry.finalAnswerLatex,
    stepLatex: entry.stepLatex,
  });
}

let caught = 0;
console.log("case".padEnd(58), "verdict");
for (const item of CASES) {
  const wrong = check(item.question, item.wrong);
  const right = check(item.question, item.right);
  const flagged = wrong.failed > 0;
  if (flagged) caught += 1;
  console.log(
    item.name.padEnd(58),
    `${flagged ? "CAUGHT" : "missed"} (wrong: pass=${wrong.passed} fail=${wrong.failed} · correct answer: fail=${right.failed})`,
  );
  const details = wrong.outcomes.filter((outcome) => outcome.status === "fail").map((outcome) => `[${outcome.kind}] ${outcome.detail}`);
  if (details.length) console.log(" ".repeat(58), details.join(" ; ").slice(0, 200));
  if (right.failed > 0) console.log(" ".repeat(58), "⚠️ the correct answer is also flagged — a false positive to fix");
}
console.log(`\ncaught ${caught}/${CASES.length} injected wrong final answers`);