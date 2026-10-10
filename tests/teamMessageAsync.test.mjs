import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { setPersistentStoreOverride } from "../src/lib/dataDir.ts";
import { setHamzaReadinessOverride } from "../src/lib/hamza/readiness.ts";
import { beginHumanMessage, completeHumanMessage, recoverStrandedMessages } from "../src/lib/team/agents.ts";
import { setTeamLlmOverride } from "../src/lib/team/gemini.ts";
import { teamRepo } from "../src/lib/team/store.ts";

const actor = { id: "async-test-staff", name: "Async Test", email: "async@example.invalid", role: "teacher" };
const values = new Map();
const backend = {
  async getJSON(key) {
    return values.has(key) ? structuredClone(values.get(key)) : null;
  },
  async setJSON(key, value) {
    values.set(key, structuredClone(value));
  },
};
const replyJson = JSON.stringify({ mode: "reply", reply: "هذا ردّ حتمي واضح وطويل بما يكفي للتدقيق." });

beforeEach(() => {
  values.clear();
  setPersistentStoreOverride(backend);
  delete process.env.TEAM_MESSAGE_LLM_TIMEOUT_MS;
  delete process.env.TEAM_MESSAGE_LLM_RETRIES;
  delete process.env.TEAM_MESSAGE_RECOVERY_MINUTES;
  setHamzaReadinessOverride({ ready: true, missing: [] });
  setTeamLlmOverride(async () => replyJson);
});

after(() => {
  setTeamLlmOverride(null);
  setHamzaReadinessOverride(null);
  setPersistentStoreOverride(null);
  delete process.env.TEAM_MESSAGE_LLM_TIMEOUT_MS;
  delete process.env.TEAM_MESSAGE_LLM_RETRIES;
  delete process.env.TEAM_MESSAGE_RECOVERY_MINUTES;
});

describe("team message async recovery", () => {
  test("human is acknowledged before the model completes, then reply is linked", async () => {
    let release;
    let firstCall = true;
    let modelStarted = false;
    setTeamLlmOverride(async () => {
      modelStarted = true;
      if (firstCall) {
        firstCall = false;
        return new Promise((resolve) => {
          release = () => resolve(replyJson);
        });
      }
      return replyJson;
    });
    const input = { channel: "mohamed", text: "رسالة اختبار لمحمد", attachments: [], actor };
    const accepted = await beginHumanMessage(input);
    assert.equal(accepted.generating, true);
    assert.equal(accepted.replies.length, 0);
    const completion = completeHumanMessage(input, accepted.message);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(modelStarted, true);
    assert.equal(accepted.message.authorKind, "human");
    assert.equal((await teamRepo().listMessages("mohamed", 20)).filter((m) => m.replyToId === accepted.message.id).length, 0);
    release();
    const done = await completion;
    assert.equal(done.replies.length, 1);
    assert.equal(done.replies[0].replyToId, accepted.message.id);
  });

  test("timeout appends exactly one honest failure notice and never loops", async () => {
    process.env.TEAM_MESSAGE_LLM_TIMEOUT_MS = "100";
    process.env.TEAM_MESSAGE_LLM_RETRIES = "1";
    setTeamLlmOverride(async () => new Promise(() => {}));
    const input = { channel: "mohamed", text: "رسالة ستنتهي مهلتها", attachments: [], actor };
    const accepted = await beginHumanMessage(input);
    const done = await completeHumanMessage(input, accepted.message);
    const replies = (await teamRepo().listMessages("mohamed", 20)).filter((m) => m.replyToId === accepted.message.id);
    assert.equal(done.replies.length, 1);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].authorKind, "system");
    assert.match(replies[0].text, /تعذّر الحصول على ردّ محمد/);
    assert.match(replies[0].text, /مهلة|محاولة/);
    assert.equal((await completeHumanMessage(input, accepted.message)).replies.length, 0);
    assert.equal((await teamRepo().listMessages("mohamed", 20)).filter((m) => m.replyToId === accepted.message.id).length, 1);
  });

  test("recovery retries one stranded message once and is idempotent", async () => {
    const input = { channel: "mohamed", text: "رسالة عالقة تحتاج استرداداً", attachments: [], actor };
    const accepted = await beginHumanMessage(input);
    await teamRepo().updateMessage(accepted.message.id, { createdAt: new Date(Date.now() - 10 * 60_000).toISOString() });
    assert.equal(await recoverStrandedMessages("mohamed"), 1);
    assert.equal(await recoverStrandedMessages("mohamed"), 0);
    const replies = (await teamRepo().listMessages("mohamed", 20)).filter((m) => m.replyToId === accepted.message.id);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].authorId, "mohamed");
  });

  test("Hamza not-configured fast path remains synchronous and does not call the model", async () => {
    setHamzaReadinessOverride({ ready: false, missing: ["GITHUB_TOKEN"] });
    let calls = 0;
    setTeamLlmOverride(async () => {
      calls += 1;
      throw new Error("fast path must not call model");
    });
    const result = await beginHumanMessage({ channel: "developer", text: "@حمزة أضف زر حجز", attachments: [], actor });
    assert.equal(result.generating, false);
    assert.equal(result.replies.length, 1);
    assert.equal(result.replies[0].authorId, "developer");
    assert.equal(calls, 0);
  });
});
