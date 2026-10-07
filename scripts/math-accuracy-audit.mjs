#!/usr/bin/env node
/**
 * Measures how often the platform's own solver produces the correct answer, and how often the
 * verification layer (CAS checks + needsReview flag) catches it when it does not.
 *
 * It calls the production code path (`solveWithOpenAI` + `runCasChecks`) unchanged; only the network
 * endpoint is redirected to the sandbox proxy so the audit can run without the production keys.
 *
 *   OPENAI_MODEL=gpt-5-mini node --import ./tests/support/register.mjs scripts/math-accuracy-audit.mjs
 *   ... --model gpt-5 --out /tmp/report.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
};
const MODEL = argValue("--model", process.env.OPENAI_MODEL?.trim() || "gpt-5-mini");
const OUT = argValue("--out", `/tmp/accuracy-${MODEL}.json`);
const CONCURRENCY = Number(argValue("--concurrency", "4"));

// The platform posts to api.openai.com; the sandbox key only works against the proxy. Redirecting the
// URL keeps the audited code path (prompt, schema, parsing) byte-for-byte identical.
const realFetch = globalThis.fetch;
const proxy = (process.env.OPENAI_API_BASE || process.env.OPENAI_BASE_URL || "").replace(/\/$/, "");
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input?.url ?? "";
  if (proxy && url.startsWith("https://api.openai.com/v1")) {
    return realFetch(`${proxy}${url.slice("https://api.openai.com/v1".length)}`, init);
  }
  return realFetch(input, init);
};

const { solveWithOpenAI } = await import("../src/lib/solver/llm.ts");
const { runCasChecks } = await import("../src/lib/solver/cas/index.ts");

/** Normalises LaTeX-ish text so expected-answer patterns can be matched reliably. */
function normalize(text) {
  return String(text ?? "")
    // \frac{a}{b} must become (a)/(b) — collapsing it to "/" first would glue the braces away.
    .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)")
    // \in must be handled BEFORE \mathbb is unwrapped, otherwise "\in\mathbb{R}" glues into "\inR"
    // and the word boundary after "in" no longer matches.
    .replace(/\\(in|notin)\b/g, (match) => (match === "\\in" ? "∈" : "∉"))
    .replace(/\\(varnothing|emptyset)\b/g, "∅")
    .replace(/\\mathbb\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\text(?:bf|it|rm)?\s*\{([^{}]*)\}/g, " $1 ")
    .replace(/\\begin\s*\{[^{}]*\}(?:\s*\{[^{}]*\})*/g, " ")
    .replace(/\\end\s*\{[^{}]*\}/g, " ")
    .replace(/\\(pi|sin|cos|tan|log|ln|times|cdot|infty|left|right|quad|operatorname)/g, (match) => {
      const map = {
        "\\pi": "pi", "\\sin": "sin", "\\cos": "cos", "\\tan": "tan", "\\log": "log", "\\ln": "ln",
        "\\times": "*", "\\cdot": "*", "\\infty": "inf", "\\left": "", "\\right": "", "\\quad": " ",
        "\\operatorname": "",
      };
      return map[match] ?? "";
    })
    .replace(/\\[,;!]/g, "")
    // Step numbering the answer box adds ("1) …", "2) …") must not become part of the value.
    .replace(/(^|[\s\\])\d+\)/g, " ")
    .toLowerCase()
    // Brackets carry no meaning for these checks: "(pi)/(6)" and "pi/6" are the same answer.
    .replace(/[()]/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, "")
    .replace(/\\+/g, "");
}

/** One item = one question with its known correct answer(s). */
const BENCH = [
  { id: "arith-1", cat: "arithmetic", q: "Compute 47 × 89.", all: [/4183/] },
  { id: "arith-2", cat: "arithmetic", q: "Compute 8 + 3 × (12 − 7)^2.", all: [/(^|[^0-9.])83([^0-9.]|$)/] },
  { id: "frac-1", cat: "fractions", q: "Compute 3/4 + 5/6 and give the simplified fraction.", all: [/19\/12|1\.583/] },
  { id: "pct-1", cat: "percent", q: "What is 15% of 240?", all: [/(^|[^0-9.])36([^0-9.]|$)/] },
  { id: "lin-1", cat: "algebra", q: "Solve for x: 5x − 7 = 3x + 9.", all: [/x=8|8$/] },
  { id: "quad-1", cat: "algebra", q: "Solve x^2 − 5x + 6 = 0.", all: [/2/, /3/] },
  { id: "quad-2", cat: "algebra", q: "Solve 2x^2 + 4x + 5 = 0 over the real numbers.", all: [/noreal|discriminant.*(-24|−24|24)|complex|nosolution|∅|emptyset|varnothing/] },
  { id: "sys-1", cat: "algebra", q: "Solve the system x + y = 10 and x − y = 4.", all: [/x=7/, /y=3/] },
  { id: "ineq-1", cat: "algebra", q: "Solve the inequality −2x + 4 > 10.", all: [/x<-3|x<−3|(-inf,-3)|(-∞,-3)/] },
  { id: "log-1", cat: "logs", q: "Compute log base 2 of 32.", all: [/(^|[^0-9.])5([^0-9.]|$)/] },
  { id: "exp-1", cat: "exponentials", q: "Solve 3^(x+1) = 81.", all: [/x=3|3$/] },
  { id: "seq-1", cat: "sequences", q: "An arithmetic sequence has first term 3 and common difference 4. Find its 10th term.", all: [/39/] },
  { id: "seq-2", cat: "sequences", q: "Compute the sum 2 + 6 + 18 + ⋯ + 2·3^5.", all: [/728/] },
  { id: "trig-1", cat: "trigonometry", q: "Compute sin 30° + cos 60°.", all: [/(^|[^0-9.])1([^0-9.]|$)/] },
  { id: "trig-2", cat: "trigonometry", q: "Solve sin x = 1/2 for x in [0, 2π].", all: [/pi\/6/, /5pi\/6/] },
  { id: "der-1", cat: "derivatives", q: "Differentiate f(x) = x^3 − 4x^2 + 7x − 2.", all: [/3x\^?2-8x\+7|3x²−8x\+7/] },
  { id: "der-2", cat: "derivatives", q: "Differentiate f(x) = sin(3x^2).", all: [/6x\*?cos\(?3x\^?2/] },
  { id: "lim-1", cat: "limits", q: "Compute the limit as x tends to 2 of (x^2 − 4)/(x − 2).", all: [/(^|[^0-9.])4([^0-9.]|$)/] },
  { id: "int-1", cat: "integrals", q: "Compute the integral from 0 to 1 of 3x^2 dx.", all: [/(^|[^0-9.])1([^0-9.]|$)/] },
  { id: "int-2", cat: "integrals", q: "Compute the indefinite integral of 2x·e^(x^2) dx.", all: [/e\^?\(?x\^?2\)?/] },
  { id: "geo-1", cat: "geometry", q: "A circle has radius 7. Find its area.", all: [/49(pi|π)/] },
  { id: "prob-1", cat: "probability", q: "Two fair dice are rolled. What is the probability that the sum is 7? Give a simplified fraction.", all: [/1\/6|0\.16/] },
  { id: "comb-1", cat: "combinatorics", q: "Compute C(8,3), the number of ways to choose 3 items from 8.", all: [/56/] },
  {
    id: "word-1",
    cat: "word problem",
    q: "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?",
    all: [/0\.05|5cents|5¢|1\/20|=5/],
  },
  {
    id: "trap-1",
    cat: "underdetermined (trap)",
    q: "Solve x + y = 5.",
    // Any answer that is honest about the missing constraint counts: a parametric family, an explicit
    // "not unique", or a statement that a second equation is needed.
    all: [/infinit|undetermined|underdetermined|notunique|many|noneunique|paramet|t∈r|t∈z|k∈z|t,5-t|y=5-x|second|needs?another|لا نهائي|لانهائي|غير محدّد|غيرمحدد|عائلة/],
    trap: true,
  },
];

/** What the student actually reads in the answer box — never the working, so nothing matches by luck. */
function answerText(solution) {
  return normalize([solution.finalAnswer, solution.finalAnswerLatex].filter(Boolean).join(" \n "));
}

async function judge(item) {
  const started = Date.now();
  let solution = null;
  let error = null;
  try {
    solution = await solveWithOpenAI({ question: item.q, language: "ar", track: "ls" });
  } catch (thrown) {
    error = thrown instanceof Error ? thrown.message : String(thrown);
  }
  if (!solution) {
    return { ...item, error, ms: Date.now() - started, correct: null, caught: null };
  }
  const cas = runCasChecks({
    question: item.q,
    checks: solution.solverMeta?.checks,
    finalAnswerLatex: solution.finalAnswerLatex ?? "",
    stepLatex: (solution.steps ?? []).map((step) => step.latex),
  });
  const text = answerText(solution);
  const answers = [solution.finalAnswer ?? "", solution.finalAnswerLatex ?? ""].map(normalize).join(" | ");
  const correct = item.all.every((pattern) => pattern.test(answers) || pattern.test(text));
  // "Caught" = the platform did not hand the answer over as certain: either its checks failed, or the
  // answer is flagged for human review, or it refused (retake) instead of guessing.
  const caught = cas.failed > 0 || solution.needsReview === true || solution.needsRetake === true;
  return {
    id: item.id,
    cat: item.cat,
    trap: Boolean(item.trap),
    ms: Date.now() - started,
    correct,
    caught,
    needsReview: Boolean(solution.needsReview),
    needsRetake: Boolean(solution.needsRetake),
    cas: {
      passed: cas.passed,
      failed: cas.failed,
      skipped: cas.skipped,
      failures: cas.outcomes
        .filter((outcome) => outcome.status === "fail")
        .slice(0, 2)
        .map((outcome) => `[${outcome.kind}] ${outcome.detail}`),
    },
    answer: (solution.finalAnswerLatex || solution.finalAnswer || "").slice(0, 160),
    question: item.q,
  };
}

/** Matches one stored answer against the benchmark's expected patterns for that question. */
function scoreStoredAnswer(id, rawAnswer) {
  const item = BENCH.find((entry) => entry.id === id);
  if (!item) return null;
  const text = normalize(rawAnswer);
  return item.all.every((pattern) => pattern.test(text));
}

const DEBUG = argValue("--debug", "");
if (DEBUG) {
  const stored = JSON.parse(readFileSync(DEBUG, "utf8"));
  for (const entry of stored.results) {
    const item = BENCH.find((candidate) => candidate.id === entry.id);
    if (!item) continue;
    const text = normalize(entry.answer);
    const hits = item.all.map((pattern) => pattern.test(text));
    if (hits.every(Boolean)) continue;
    console.log(`${entry.id}  raw=${JSON.stringify(entry.answer)}`);
    console.log(`  normalized=${JSON.stringify(text)}`);
    console.log(`  patterns=${item.all.map((p) => p.source).join(" | ")} → ${hits.join(",")}`);
  }
  process.exit(0);
}

const RESCORE = argValue("--rescore", "");
if (RESCORE) {
  const stored = JSON.parse(readFileSync(RESCORE, "utf8"));
  const rescored = stored.results.map((entry) => (entry.correct === null ? entry : { ...entry, correct: scoreStoredAnswer(entry.id, entry.answer) }));
  const scoredNow = rescored.filter((entry) => entry.correct !== null);
  const right = scoredNow.filter((entry) => entry.correct).length;
  const wrongNow = scoredNow.filter((entry) => !entry.correct);
  console.log(`=== rescored ${stored.model} ===`);
  console.log(`correct: ${right}/${scoredNow.length} (${((right / Math.max(scoredNow.length, 1)) * 100).toFixed(1)}%)`);
  console.log(`wrong uncaught: ${wrongNow.filter((entry) => !entry.caught).length} · wrong but flagged: ${wrongNow.filter((entry) => entry.caught).length}`);
  for (const entry of wrongNow) console.log(`  ${entry.id}${entry.caught ? " [flagged]" : " [NOT flagged]"} → ${entry.answer}`);
  const byCat = {};
  for (const entry of scoredNow) {
    byCat[entry.cat] ??= { total: 0, correct: 0 };
    byCat[entry.cat].total += 1;
    byCat[entry.cat].correct += entry.correct ? 1 : 0;
  }
  console.log("by category:", JSON.stringify(byCat));
  writeFileSync(RESCORE.replace(/\.json$/, "-rescored.json"), JSON.stringify({ ...stored, results: rescored, rescored: { correct: right, total: scoredNow.length, byCategory: byCat } }, null, 2));
  process.exit(0);
}

async function runPool(items, size, worker) {
  const results = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      const result = await worker(current);
      results.push(result);
      console.log(`  ${result.correct ? "✔" : "✘"} ${result.id} (${result.ms}ms)${result.caught && !result.correct ? " [caught]" : ""}`);
    }
  });
  await Promise.all(runners);
  return results;
}

console.log(`model=${MODEL} · items=${BENCH.length} · concurrency=${CONCURRENCY}\n`);
const results = await runPool(BENCH, CONCURRENCY, judge);
const scored = results.filter((item) => item.correct !== null);
const correct = scored.filter((item) => item.correct).length;
const wrong = scored.filter((item) => !item.correct);
const wrongCaught = wrong.filter((item) => item.caught).length;
const byCat = {};
for (const item of scored) {
  byCat[item.cat] ??= { total: 0, correct: 0 };
  byCat[item.cat].total += 1;
  byCat[item.cat].correct += item.correct ? 1 : 0;
}

const summary = {
  model: MODEL,
  total: BENCH.length,
  scored: scored.length,
  errors: results.filter((item) => item.error).length,
  correct,
  accuracy: Number(((correct / Math.max(scored.length, 1)) * 100).toFixed(1)),
  wrong: wrong.length,
  wrongCaught,
  wrongUncaught: wrong.length - wrongCaught,
  avgMs: Math.round(scored.reduce((sum, item) => sum + item.ms, 0) / Math.max(scored.length, 1)),
  byCategory: byCat,
  failures: wrong.map((item) => ({ id: item.id, question: item.question, answer: item.answer, caught: item.caught, casFailures: item.cas.failures })),
  results,
};
writeFileSync(OUT, JSON.stringify(summary, null, 2));

console.log(`\n=== ${MODEL} ===`);
console.log(`answered correctly : ${correct}/${scored.length} (${summary.accuracy}%)`);
console.log(`wrong answers      : ${wrong.length} — of them flagged/caught by the platform: ${wrongCaught}, delivered as certain: ${summary.wrongUncaught}`);
console.log(`errors/timeouts    : ${summary.errors} · avg latency: ${summary.avgMs}ms`);
console.log("by category:");
for (const [cat, value] of Object.entries(byCat)) console.log(`  ${cat}: ${value.correct}/${value.total}`);
if (wrong.length) {
  console.log("wrong items:");
  for (const item of wrong) console.log(`  ${item.id}${item.caught ? " [flagged]" : " [NOT flagged]"} → ${item.answer}`);
}
console.log(`\nfull report: ${OUT}`);
