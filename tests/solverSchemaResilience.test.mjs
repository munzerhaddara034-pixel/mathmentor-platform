// A model label outside the enum ("integrals", "derivatives", "trigonometry") used to fail the Zod
// parse of the whole solution, so the student got an error instead of a correct answer. These tests
// pin the tolerant behaviour and prove an integral question now returns a solution.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asymptoteSchema, coerceAsymptoteKind, coerceStudyKind, studyKindSchema } from "../src/lib/solver/studyKindSchema.ts";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

/** Runs the production OpenAI solve path against a canned provider response (no network). */
async function solveWithCannedResponse(payload) {
  process.env.OPENAI_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    text: async () => JSON.stringify(payload),
  });
  try {
    const { solveWithOpenAI } = await import("../src/lib/solver/llm.ts");
    return await solveWithOpenAI({ question: "Compute the integral from 0 to 1 of 3x^2 dx.", language: "ar", track: "ls" });
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
}

const INTEGRAL_PAYLOAD = {
  studyKind: "integrals",
  summary: "Definite integral of a power",
  finalAnswer: "1",
  finalAnswerLatex: "1",
  topic: "definite integral",
  steps: [{ title: "Integrate", latex: "\\int_0^1 3x^2\\,dx=1", explanationEn: "Antiderivative then evaluate at the bounds." }],
};

describe("solver classification is tolerant", () => {
  test("coerceStudyKind maps neighbouring model labels onto supported kinds", () => {
    for (const label of ["integrals", "integral", "derivatives", "derivative", "calculus", "Differentiation"]) {
      assert.equal(coerceStudyKind(label), "real_function", label);
    }
    for (const label of ["trigonometry", "trig", "sequences", "systems", "inequalities"]) {
      assert.equal(coerceStudyKind(label), "algebra", label);
    }
    assert.equal(coerceStudyKind("statistics"), "probability");
    assert.equal(coerceStudyKind("vectors"), "geometry");
    assert.equal(coerceStudyKind("complex numbers"), "complex", "spaces and hyphens are normalised");
    // Already valid values pass through untouched.
    for (const kind of ["real_function", "geometry", "complex", "probability", "algebra", "limits", "general"]) {
      assert.equal(coerceStudyKind(kind), kind);
      assert.equal(coerceStudyKind(`  ${kind.toUpperCase()}  `), kind);
    }
    // Unrecognisable labels degrade instead of throwing, and non-strings are dropped.
    assert.equal(coerceStudyKind("banana"), "general");
    assert.equal(coerceStudyKind(undefined), undefined);
    assert.equal(coerceStudyKind(7), undefined);
    assert.equal(coerceStudyKind(null), undefined);
  });

  test("studyKindSchema never rejects a payload", () => {
    assert.equal(studyKindSchema.parse("integrals"), "real_function");
    assert.equal(studyKindSchema.parse("banana"), "general");
    assert.equal(studyKindSchema.parse(undefined), undefined);
    assert.equal(studyKindSchema.parse(42), undefined);
    assert.equal(studyKindSchema.safeParse("calculus").success, true);
  });

  test("asymptote kinds are normalised and unknown shapes fail only locally", () => {
    assert.equal(coerceAsymptoteKind("Slanted"), "oblique");
    assert.equal(coerceAsymptoteKind("diagonal"), "oblique");
    assert.equal(coerceAsymptoteKind("VERTICAL"), "vertical");
    assert.equal(coerceAsymptoteKind("weird"), undefined);
    assert.equal(asymptoteSchema.parse({ kind: "diagonal", equation: "y=x+1" }).kind, "oblique");
    assert.equal(asymptoteSchema.safeParse({ kind: "weird", equation: "y=x" }).success, false);
  });

  test("an integral question returns a solution instead of throwing", async () => {
    const solution = await solveWithCannedResponse(INTEGRAL_PAYLOAD);
    assert.equal(solution.finalAnswerLatex, "1");
    assert.ok(solution.steps.length >= 1);
    assert.equal(solution.studyKind, "real_function");
  });

  test("a nonsense label, a bad asymptote and a broken graph window still return the answer", async () => {
    const solution = await solveWithCannedResponse({
      ...INTEGRAL_PAYLOAD,
      studyKind: "banana",
      asymptotes: [{ kind: "diagonal", equation: "y=x+1" }, { kind: "weird", equation: "y=0" }],
      graph: { fn: "x^2", domain: ["a", "b"] },
    });
    assert.equal(solution.finalAnswerLatex, "1");
    assert.equal(solution.studyKind, "general");
    assert.equal(solution.asymptotes?.length, 1, "only the valid asymptote survives");
    assert.equal(solution.asymptotes?.[0].kind, "oblique");
    assert.ok(solution.graph === undefined || solution.graph.domain === undefined, "the broken window is dropped");
  });

  test("both solver entry points use the shared tolerant schema", () => {
    for (const file of ["src/lib/solver/llm.ts", "src/lib/voiceMath/parser.ts"]) {
      const source = read(file);
      assert.match(source, /studyKindSchema/, `${file} imports the shared schema`);
      assert.ok(
        !/\.enum\(\["real_function", "geometry", "complex", "probability", "algebra", "limits", "general"\]\)/.test(source),
        `${file} no longer hard-fails on the strict enum`,
      );
    }
  });
});