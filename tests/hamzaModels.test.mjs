import { test } from "node:test";
import assert from "node:assert/strict";
import { hamzaConfig } from "../src/lib/hamza/config.ts";
import { addUsage, beirutMonth, checkBudget, emptyCost, estimateFor } from "../src/lib/hamza/cost.ts";
import { priceTable, usageCostUsd } from "../src/lib/hamza/models/pricing.ts";
import { ProviderError } from "../src/lib/hamza/models/providers.ts";
import { ModelChainExhaustedError, modelChain, routeModelCall } from "../src/lib/hamza/models/router.ts";

const env = {
  HAMZA_MODEL_PRIMARY: "gemini-3.1-pro-preview",
  HAMZA_MODEL_FALLBACKS: "gemini-3.8-flash,openai:gpt-5.3-codex",
  HAMZA_MODEL_CHEAP: "gemini-3.8-flash",
};
const request = { step: "plan", system: "s", turns: [{ role: "user", text: "hi" }], json: true };
const usage = { inputTokens: 1000, cachedTokens: 0, outputTokens: 100 };

test("chains come from env: primary → fallbacks; cheap tier starts with the cheap model; legacy only when unset", () => {
  const c = hamzaConfig(env);
  assert.deepEqual(modelChain(c, "primary").map((m) => m.id), ["gemini:gemini-3.1-pro-preview", "gemini:gemini-3.8-flash", "openai:gpt-5.3-codex"]);
  assert.deepEqual(modelChain(c, "cheap").map((m) => m.id), ["gemini:gemini-3.8-flash", "openai:gpt-5.3-codex", "gemini:gemini-3.1-pro-preview"]);
  assert.deepEqual(modelChain(hamzaConfig({}), "primary", ["gemini-flash-latest"]).map((m) => m.id), ["gemini:gemini-flash-latest"]);
});

test("router falls back on 429, 5xx, timeout and malformed JSON; records attempts and bills every answer", async () => {
  const chain = modelChain(hamzaConfig(env), "primary");
  const seen = [];
  const transport = async (spec) => {
    seen.push(spec.id);
    if (spec.model === "gemini-3.1-pro-preview") throw new ProviderError("429 quota", 429);
    if (spec.model === "gemini-3.8-flash") return { text: "not json", usage };
    return { text: '{"action":"reply"}', usage };
  };
  const r = await routeModelCall({ chain, request, transport });
  assert.equal(r.model, "openai:gpt-5.3-codex");
  assert.deepEqual(r.json, { action: "reply" });
  assert.deepEqual(r.attempts.map((a) => a.ok), [false, false, true]);
  assert.match(r.attempts[1].error, /malformed JSON/);
  assert.equal(r.usage.inputTokens, 2000, "the malformed answer is billed too");
  assert.ok(r.usd > 0);
  await assert.rejects(
    routeModelCall({ chain, request, transport: async () => { throw new Error("timeout"); } }),
    (error) => error instanceof ModelChainExhaustedError && error.attempts.length === 3,
  );
});

test("pricing: known table, env override, conservative fallback; cached input is cheaper", () => {
  assert.equal(usageCostUsd("gemini-3.1-pro-preview", { inputTokens: 1_000_000, cachedTokens: 0, outputTokens: 1_000_000 }), 14);
  assert.equal(usageCostUsd("gemini-3.1-pro-preview", { inputTokens: 1_000_000, cachedTokens: 1_000_000, outputTokens: 0 }), 0.2);
  const prices = priceTable({ HAMZA_MODEL_PRICES: '{"gemini:my-model":{"in":1,"out":2}}', HAMZA_DEFAULT_PRICE: "3,15" });
  assert.equal(usageCostUsd("my-model", { inputTokens: 1_000_000, cachedTokens: 0, outputTokens: 1_000_000 }, prices), 3);
  assert.equal(usageCostUsd("unknown-x", { inputTokens: 1_000_000, cachedTokens: 0, outputTokens: 0 }, prices), 3);
  assert.equal(priceTable({ HAMZA_MODEL_PRICES: "{broken" }).table["gpt-5.3-codex"].out, 14);
});

test("cost ledger, $2 task / $60 month budgets, estimates, Beirut month", () => {
  let c = emptyCost(0.25);
  c = addUsage(c, { model: "gemini:a", usd: 0.5, usage });
  c = addUsage(c, { model: "gemini:a", usd: 0.25, usage });
  assert.deepEqual([c.usd, c.calls, c.models, c.inputTokens, c.estimateUsd], [0.75, 2, ["gemini:a"], 2000, 0.25]);
  assert.deepEqual(checkBudget({ taskUsd: 1.9, taskCapUsd: 2, monthUsd: 10, monthCapUsd: 60 }).ok, true);
  assert.deepEqual(checkBudget({ taskUsd: 2, taskCapUsd: 2, monthUsd: 10, monthCapUsd: 60 }), { ok: false, reason: "task", spentUsd: 2, capUsd: 2 });
  assert.equal(checkBudget({ taskUsd: 0, taskCapUsd: 2, monthUsd: 60, monthCapUsd: 60 }).reason, "month");
  assert.equal(estimateFor("fix typo"), 0.25);
  assert.equal(estimateFor("x ".repeat(100)), 3);
  // 1 Oct 00:30 Beirut (UTC+3) is still 30 Sep in UTC.
  assert.deepEqual(beirutMonth(new Date("2026-09-30T21:30:00Z")), { key: "2026-10", startIso: "2026-09-30T21:00:00.000Z" });
  assert.equal(beirutMonth(new Date("2026-09-30T20:59:00Z")).key, "2026-09");
});
