// Solver time budget: one deadline per request, per-call budgets clamped to it, and the rule that the
// verification pass only runs synchronously when there is room left. Guards the production failure where
// solve + repair + verify added up past the platform timeout and the student got no answer at all.
import { describe, test } from "node:test";
import assert from "node:assert/strict";

const budget = await import("../src/lib/solver/budget.ts");
const llm = await import("../src/lib/solver/llm.ts");

describe("solver time budget", () => {
  test("a deadline reports what is left and when it is over", () => {
    const deadline = budget.createDeadline(30_000, 1_000);
    assert.equal(deadline.remaining(1_000), 30_000);
    assert.equal(deadline.remaining(11_000), 20_000);
    assert.equal(deadline.remaining(31_000), 0);
    assert.equal(deadline.expired(30_999), false);
    assert.equal(deadline.expired(31_000), true);
  });

  test("a per-call budget never gets more than the remaining time", () => {
    const tier = { thinking: "medium", maxOutputTokens: 16_384, deadlineMs: 120_000, callTimeoutMs: 90_000 };
    const clamped = budget.clampSolverBudget(tier, 25_000);
    assert.equal(clamped.deadlineMs, 25_000);
    assert.equal(clamped.callTimeoutMs, 25_000);
    // Extra fields survive the clamp: the caller still gets its model settings.
    assert.equal(clamped.thinking, "medium");
    assert.equal(clamped.maxOutputTokens, 16_384);
  });

  test("the per-call timeout never exceeds its own deadline", () => {
    const clamped = budget.clampSolverBudget({ deadlineMs: 10_000, callTimeoutMs: 90_000 }, 40_000);
    assert.equal(clamped.deadlineMs, 10_000);
    assert.equal(clamped.callTimeoutMs, 10_000);
  });

  test("a hopeless call still gets a small floor instead of hanging", () => {
    const clamped = budget.clampSolverBudget({ deadlineMs: 120_000, callTimeoutMs: 90_000 }, 200);
    assert.equal(clamped.deadlineMs, budget.SOLVER_MIN_CALL_MS);
    assert.ok(clamped.callTimeoutMs <= clamped.deadlineMs);
  });

  test("verification and extra calls are skipped when little time is left", () => {
    assert.equal(budget.shouldVerifySynchronously(budget.SOLVER_VERIFY_MIN_MS), true);
    assert.equal(budget.shouldVerifySynchronously(budget.SOLVER_VERIFY_MIN_MS - 1), false);
    assert.equal(budget.canStartCall(budget.SOLVER_MIN_CALL_MS), true);
    assert.equal(budget.canStartCall(budget.SOLVER_MIN_CALL_MS - 1), false);
  });

  test("the default budget stays inside a hosting platform's request timeout", () => {
    assert.ok(budget.SOLVER_TOTAL_BUDGET_MS <= 60_000, `budget ${budget.SOLVER_TOTAL_BUDGET_MS} must fit the platform timeout`);
    assert.ok(budget.SOLVER_TOTAL_BUDGET_MS >= budget.SOLVER_VERIFY_MIN_MS);
  });

  test("the rescue path forces the fast model tier on the free Gemini key", async () => {
    const seen = [];
    const originalFetch = globalThis.fetch;
    const saved = { key: process.env.GEMINI_API_KEY, strong: process.env.GEMINI_STRONG_MODELS, fast: process.env.GEMINI_FAST_MODELS };
    process.env.GEMINI_API_KEY = "unit-test-gemini-key-0001";
    process.env.GEMINI_STRONG_MODELS = "gemini-pro-latest";
    process.env.GEMINI_FAST_MODELS = "gemini-flash-latest";
    globalThis.fetch = async (url) => {
      seen.push(String(url));
      return new Response("{}", { status: 500 });
    };
    try {
      const llm = await import("../src/lib/solver/llm.ts");
      await llm
        .solveWithGemini({ question: "حل المعادلة x^2-5x+6=0", language: "ar" }, { deadlineMs: 20000, tierOverride: "fast" })
        .catch(() => undefined);
      assert.equal(seen.some((u) => u.includes("gemini-flash-latest")), true);
      assert.equal(seen.some((u) => u.includes("gemini-pro-latest")), false);
    } finally {
      globalThis.fetch = originalFetch;
      if (saved.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved.key;
      if (saved.strong === undefined) delete process.env.GEMINI_STRONG_MODELS; else process.env.GEMINI_STRONG_MODELS = saved.strong;
      if (saved.fast === undefined) delete process.env.GEMINI_FAST_MODELS; else process.env.GEMINI_FAST_MODELS = saved.fast;
    }
  });

  test("an unusable DeepSeek key is refused instead of shortening Gemini's budget", async () => {
    const llm = await import("../src/lib/solver/llm.ts");
    const saved = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = "ضع_مفتاح_DeepSeek_هنا";
    assert.equal(llm.deepseekSolverKey(), "");
    assert.match(String(llm.deepseekConfigIssue()), /unusable/);
    process.env.DEEPSEEK_API_KEY = "unit-test-deepseek-key-0001";
    assert.equal(llm.deepseekSolverKey().length > 0, true);
    assert.equal(llm.deepseekConfigIssue(), null);
    if (saved === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = saved;
  });

  test("a rescue window is held back so a fast provider can still answer", () => {
    assert.equal(budget.primaryBudgetMs(55_000, 15_000), 40_000);
    assert.equal(budget.primaryBudgetMs(20_000, 15_000), 5_000 > budget.SOLVER_MIN_CALL_MS ? 5_000 : budget.SOLVER_MIN_CALL_MS);
    assert.equal(budget.primaryBudgetMs(10_000, 15_000), budget.SOLVER_MIN_CALL_MS);
    assert.equal(budget.primaryBudgetMs(40_000, 0), 40_000);
    assert.ok(budget.SOLVER_RESCUE_RESERVE_MS > 0);
  });

  test("DeepSeek is optional and refuses to run without a key", async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    assert.equal(llm.deepseekSolverKey(), "");
    await assert.rejects(() => llm.solveWithDeepSeek({ question: "2+2" }), /DEEPSEEK_API_KEY is not set/);
    if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous;
  });
});