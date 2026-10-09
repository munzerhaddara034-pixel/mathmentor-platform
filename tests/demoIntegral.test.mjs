// The offline fallback must answer the integral it was asked — it used to return "x^2 + C" for every integral.
import { describe, test } from "node:test";
import assert from "node:assert/strict";

const { demoSolve } = await import("../src/lib/solver/demoSolver.ts");

const answer = (question) => demoSolve({ question, language: "ar" });

describe("offline integral fallback", () => {
  test("applies the real power rule to the asked integrand", () => {
    assert.equal(answer("احسب التكامل: ∫ x^2 dx").finalAnswer, "(x^3)/3+C");
    assert.equal(answer("احسب ∫ 2x dx").finalAnswer, "x^2+C");
    assert.equal(answer("احسب التكامل غير المحدد ∫ x^3 dx").finalAnswer, "(x^4)/4+C");
    assert.equal(answer("احسب ∫ (3x^2 + 2x) dx").finalAnswer, "x^3+x^2+C");
    assert.equal(answer("احسب ∫ 5 dx").finalAnswer, "5x+C");
  });

  test("LaTeX output carries the same result", () => {
    assert.equal(answer("∫ x^2 dx").finalAnswerLatex, "\\dfrac{x^{3}}{3}+C");
    assert.equal(answer("∫ 2x dx").finalAnswerLatex, "x^{2}+C");
  });

  test("never asserts a false answer for an integral it cannot handle", () => {
    const solution = answer("احسب ∫ sin x dx");
    assert.equal(solution.finalAnswer.includes("\\int f(x)"), true);
    assert.equal(solution.finalAnswer.includes("x^2 + C"), false);
  });
});
