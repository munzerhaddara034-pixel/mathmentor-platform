// Deterministic CAS check (mathjs): fixtures are the exact errors from the 9-question exam.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { runCasChecks } from "../src/lib/solver/cas/index.ts";

const A = [["4", "1", "-1"], ["2", "5", "-2"], ["1", "1", "2"]];
const run = (checks, extra = {}) =>
  runCasChecks({ question: "", finalAnswerLatex: "", stepLatex: [], checks, ...extra });
const statuses = (report) => report.outcomes.map((o) => o.status);

test("linear system (M1) passes; a wrong solution fails", () => {
  const eq = ["3*x+2*y=11", "2*x+3*y=9"];
  assert.deepEqual(statuses(run([{ kind: "linear_system", equations: eq, solution: { x: "3", y: "1" } }])), ["pass"]);
  assert.deepEqual(statuses(run([{ kind: "linear_system", equations: eq, solution: { x: 1, y: 4 } }])), ["fail"]);
});

test("eigenpairs (U1): the delivered (−1,2,0) and (1,1,1) fail, the key passes", () => {
  const bad = run([
    { kind: "eigenpair", matrix: A, value: "3", vector: ["-1", "2", "0"] },
    { kind: "eigenpair", matrix: A, value: "5", vector: ["1", "1", "1"] },
  ]);
  assert.deepEqual(statuses(bad), ["fail", "fail"]);
  const good = run([
    { kind: "eigenpair", matrix: A, value: "3", vector: ["-1", "1", "0"] },
    { kind: "eigenpair", matrix: A, value: "3", vector: ["1", "0", "1"] },
    { kind: "eigenpair", matrix: A, value: "5", vector: ["1", "2", "1"] },
    { kind: "diagonalization", matrix: A, P: [["-1", "1", "1"], ["1", "0", "2"], ["0", "1", "1"]], D: [["3", "0", "0"], ["0", "3", "0"], ["0", "0", "5"]] },
  ]);
  assert.deepEqual(statuses(good), ["pass", "pass", "pass", "pass"]);
  const wrongP = run([{ kind: "diagonalization", matrix: A, P: [["1", "-1", "1"], ["0", "2", "1"], ["1", "0", "1"]], D: [["3", "0", "0"], ["0", "3", "0"], ["0", "0", "5"]] }]);
  assert.deepEqual(statuses(wrongP), ["fail"]);
});

test("matrix transcribed differently from the statement is flagged", () => {
  const report = runCasChecks({
    question: "Let A = [[4, 1, −1], [2, 5, −2], [1, 1, 2]] (rows).",
    finalAnswerLatex: "",
    stepLatex: [],
    checks: [{ kind: "eigenpair", matrix: [["4", "1", "1"], ["2", "5", "-2"], ["1", "1", "2"]], value: "3", vector: ["1", "0", "1"] }],
  });
  assert.ok(report.outcomes.some((o) => o.kind === "question_matrix" && o.status === "fail"));
});

test("ODE + initial conditions (U2): C1=2, C2=−1 fails y'(0)=0; (1−x)e^x passes", () => {
  const base = { kind: "ode", lhs: "y2 - 3*y1 + 2*y0", rhs: "exp(x)", conditions: [{ order: 0, at: "0", value: "1" }, { order: 1, at: "0", value: "0" }] };
  const bad = run([{ ...base, solution: "-x*exp(x) + 2*exp(x) - exp(2*x)" }]);
  assert.equal(bad.outcomes[0].status, "fail");
  assert.match(bad.outcomes[0].detail, /y'\(0\)/);
  assert.deepEqual(statuses(run([{ ...base, solution: "(1-x)*exp(x)" }])), ["pass"]);
  assert.deepEqual(statuses(run([{ ...base, solution: "x*exp(x)", conditions: [] }])), ["fail"]);
});

test("integral (S3), limits, derivative, root (S1)", () => {
  const r = run([
    { kind: "integral", integrand: "x*log(x)", lower: "1", upper: "e", value: "(e^2+1)/4" },
    { kind: "integral", integrand: "x*log(x)", lower: "1", upper: "e", value: "2.09" },
    { kind: "limit", expr: "(x-1)*exp(x)", to: "-inf", value: "0" },
    { kind: "limit", expr: "(x-1)*exp(x)", to: "inf", value: "inf" },
    { kind: "derivative", fn: "(x-1)*exp(x)", derivative: "x*exp(x)" },
    { kind: "derivative", fn: "(x-1)*exp(x)", derivative: "exp(x)" },
    { kind: "root", expr: "(x-1)*exp(x)-1", value: "1.27846", lower: "1.27", upper: "1.28" },
    { kind: "equal", left: "(1+i*sqrt(3))^6", right: "64" },
    { kind: "equal", left: "(1+i*sqrt(3))^6", right: "-64" },
    { kind: "equal", left: "cos(7*pi/12)", right: "(sqrt(2)-sqrt(6))/4" },
  ]);
  assert.deepEqual(statuses(r), ["pass", "fail", "pass", "pass", "pass", "fail", "pass", "pass", "fail", "pass"]);
});

test("final box vs steps (S2): box z_1^6 = −64 contradicts the step's 64", () => {
  const report = runCasChecks({
    question: "",
    checks: [],
    finalAnswerLatex: "z_{1}^{6} = -64",
    stepLatex: ["z_{1}^{6} = (2 e^{i\\frac{\\pi}{3}})^{6} = 2^{6} e^{i 2\\pi} = 64 \\times 1 = 64"],
  });
  assert.deepEqual(statuses(report), ["fail"]);
  const ok = runCasChecks({
    question: "",
    checks: [],
    finalAnswerLatex: "\\boxed{A = 11\\sqrt{2}, \\quad C = 2\\sqrt{3}}",
    stepLatex: ["A = 15\\sqrt{2} - 6\\sqrt{2} + 2\\sqrt{2} = 11\\sqrt{2}", "C = \\frac{6\\sqrt{3}}{3} = 2\\sqrt{3}"],
  });
  assert.deepEqual(statuses(ok), ["pass", "pass"]);
});

test("malformed checks never throw", () => {
  const r = run([{ kind: "eigenpair", matrix: "nope" }, null, { kind: "limit", expr: "1/(", to: "0", value: "1" }]);
  assert.equal(r.failed, 0);
  assert.ok(r.skipped >= 2);
});

test("final box vs steps with numbered lines (SAT retest): box x + y = 3 vs steps 5", () => {
  const report = runCasChecks({
    question: "",
    checks: [],
    finalAnswerLatex: "\\begin{array}{l} 1)\\ x + y = 3 \\text{ (Choice A)} \\\\ 2)\\ c = 25 \\text{ (Choice D)} \\end{array}",
    stepLatex: ["\\begin{aligned} x + y &= 2 + 3 = 5 \\end{aligned}", "\\Delta = 100 - 4c = 0 \\\\ c = 25"],
  });
  assert.deepEqual(report.outcomes.map((o) => o.status).sort(), ["fail", "pass"]);
});
