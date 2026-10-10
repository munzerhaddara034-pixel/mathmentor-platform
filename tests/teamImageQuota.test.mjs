import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { setPersistentStoreOverride } from "../src/lib/dataDir.ts";
import { handleHumanMessage } from "../src/lib/team/agents.ts";
import { setTeamLlmOverride } from "../src/lib/team/gemini.ts";
import { generateImage, resetImageProviderCooldownForTests } from "../src/lib/team/images.ts";

const originalEnv = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  LLM_API_KEY: process.env.LLM_API_KEY,
  SAMI_IMAGE_GEN: process.env.SAMI_IMAGE_GEN,
  SAMI_IMAGE_PROVIDER: process.env.SAMI_IMAGE_PROVIDER,
  SAMI_IMAGE_MODEL: process.env.SAMI_IMAGE_MODEL,
  SAMI_IMAGE_COOLDOWN_MINUTES: process.env.SAMI_IMAGE_COOLDOWN_MINUTES,
};
const originalFetch = globalThis.fetch;
const values = new Map();
const backend = {
  async getJSON(key) {
    return values.has(key) ? structuredClone(values.get(key)) : null;
  },
  async setJSON(key, value) {
    values.set(key, structuredClone(value));
  },
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function quotaResponse(status = 429, body = { error: { message: "You exceeded your current quota. RESOURCE_EXHAUSTED" } }) {
  return { ok: false, status, async text() { return JSON.stringify(body); } };
}

beforeEach(() => {
  values.clear();
  setTeamLlmOverride(null);
  setPersistentStoreOverride(backend);
  resetImageProviderCooldownForTests();
  process.env.GEMINI_API_KEY = "AIzaUnitTestImageKey000000000000000000000";
  delete process.env.GOOGLE_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.LLM_API_KEY;
  delete process.env.SAMI_IMAGE_GEN;
  delete process.env.SAMI_IMAGE_PROVIDER;
  delete process.env.SAMI_IMAGE_MODEL;
  process.env.SAMI_IMAGE_COOLDOWN_MINUTES = "10";
});

after(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
  resetImageProviderCooldownForTests();
  setTeamLlmOverride(null);
  setPersistentStoreOverride(null);
});

describe("Sami image quota reliability", () => {
  test("429 quota marks provider unavailable, aborts model fallback, and cooldown skips the following turn", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return quotaResponse();
    };

    const first = await generateImage("preview prompt");
    const second = await generateImage("same preview on next turn");

    assert.deepEqual(first, { ok: false, reason: "quota", message: first.message });
    assert.equal(first.reason, "quota");
    assert.equal(second.ok, false);
    assert.equal(second.reason, "quota");
    assert.equal(calls, 1, "quota must stop the second Gemini model and cooldown must stop the next turn");
  });

  test("Youssef returns the complete text answer with an honest quota notice and no fake preview claim", async () => {
    let imageCalls = 0;
    globalThis.fetch = async () => {
      imageCalls += 1;
      return quotaResponse();
    };
    let llmCalls = 0;
    setTeamLlmOverride(async () => {
      llmCalls += 1;
      if (llmCalls === 1) return JSON.stringify({ action: "tool", tool: "team_memory", args: {} });
      return JSON.stringify({
        action: "reply",
        replyAr: JSON.stringify({
          reply: "المواصفات الكاملة: بانر 1080x1080، خلفية زرقاء، والنص العربي مضبوط RTL. قمت بتوليد معاينة ممتازة للتصميم.",
          imagePrompt: "A blue square banner",
          generateImage: true,
        }),
      });
    });

    const result = await handleHumanMessage({
      channel: "team",
      text: "@يوسف صمّم بانراً مربعاً",
      attachments: [],
      actor: { id: "quota-test", name: "Quota Test", email: "quota@example.invalid", role: "teacher" },
    });
    const reply = result.replies.find((item) => item.authorId === "sami");

    assert.ok(reply);
    assert.match(reply.text, /المواصفات الكاملة/);
    assert.doesNotMatch(reply.text, /قمت بتوليد معاينة/);
    assert.match(reply.notice ?? "", /out of quota|الحصّة/);
    assert.match(reply.notice ?? "", /المواصفات النصية كاملة/);
    assert.equal(reply.attachments.length, 0);
    assert.equal(imageCalls, 1);
    const stored = JSON.stringify([...values.values()]);
    assert.doesNotMatch(stored, /AIzaUnitTestImageKey/);
  });

  test("non-quota image errors retain provider fallback behavior", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return quotaResponse(503, { error: { message: "temporary upstream unavailable" } });
    };

    const result = await generateImage("preview prompt");

    assert.equal(result.ok, false);
    assert.equal(result.reason, "provider");
    assert.match(result.message ?? "", /503/);
    assert.equal(calls, 2, "non-quota errors should still try the next Gemini model");
  });

  test("provider notices and records never expose API keys or bearer tokens", async () => {
    const key = process.env.GEMINI_API_KEY;
    const token = "Bearer test-token-value-that-must-not-leak-123456";
    globalThis.fetch = async () => quotaResponse(500, { error: { message: `upstream failed ${key} ${token}` } });

    const result = await generateImage("preview prompt");

    assert.equal(result.reason, "provider");
    assert.doesNotMatch(result.message ?? "", /AIzaUnitTestImageKey|test-token-value/);
    assert.doesNotMatch(JSON.stringify([...values.values()]), /AIzaUnitTestImageKey|test-token-value/);
  });
});
