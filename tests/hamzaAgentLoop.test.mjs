import { test } from "node:test";
import assert from "node:assert/strict";
import { compactTurns, runAgentLoop } from "../src/lib/hamza/agent/loop.ts";
import { parseAgentAction } from "../src/lib/hamza/agent/protocol.ts";
import { memorySnapshot } from "../src/lib/hamza/snapshot.ts";
import { createRepoTools } from "../src/lib/hamza/tools.ts";
import { gitBlobSha } from "./support/fakeGithub.mjs";

const files = { "src/components/Hello.tsx": "export function Hello() {\n  return <p>Hello</p>;\n}\n" };
const limits = { maxSteps: 12, maxToolCalls: 3, timeoutMs: 60_000, maxPatchRounds: 3, taskCapUsd: 2, monthCapUsd: 60 };
const usage = { inputTokens: 100, cachedTokens: 0, outputTokens: 10 };

function scripted(answers, usd = 0.01) {
  const requests = [];
  return {
    requests,
    call: async (request) => {
      requests.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error("script exhausted");
      const text = typeof next === "string" ? next : JSON.stringify(next);
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      return { text, json, model: "gemini:test", usage, usd, attempts: [] };
    },
  };
}

function deps(model, extra = {}) {
  const snapshot = memorySnapshot(files, { sha: "c".repeat(40), shaOf: gitBlobSha });
  let t = 0;
  const steps = [];
  return {
    steps,
    value: {
      call: model.call,
      tools: createRepoTools({ snapshot, ciChecks: ["hamza-ci"] }),
      snapshot,
      nowMs: () => (t += 1000),
      monthSpentUsd: async () => 0,
      onStep: async (step) => steps.push(step),
      syntax: async () => ({ ran: true, errors: [] }),
      ...extra,
    },
  };
}

const goodPatch = {
  action: "propose",
  summaryAr: "تغيير التحية",
  commitMessage: "feat: say hi",
  branch: "feat/say-hi",
  replyAr: "جاهز للمراجعة",
  patch: [{ op: "edit", path: "src/components/Hello.tsx", edits: [{ search: "<p>Hello</p>", replace: "<p>Hi</p>" }] }],
};

test("explore → bad patch (prechecks feed back) → fixed patch → proposal draft", async () => {
  const badPatch = { ...goodPatch, patch: [{ op: "edit", path: "src/components/Hello.tsx", edits: [{ search: "<p>Hello</p>", replace: "<p>{(x as any)}</p>" }] }] };
  const model = scripted([
    { action: "tool", tool: "grep", args: { pattern: "Hello" } },
    { action: "tool", tool: "read_file", args: { path: "src/components/Hello.tsx" } },
    badPatch,
    goodPatch,
  ]);
  const d = deps(model);
  const out = await runAgentLoop(d.value, limits, { system: "sys", turns: [{ role: "user", text: "say hi" }] });
  assert.equal(out.kind, "proposal");
  assert.equal(out.draft.files[0].newContent, "export function Hello() {\n  return <p>Hi</p>;\n}\n");
  assert.equal(out.draft.files[0].baseSha, gitBlobSha(files["src/components/Hello.tsx"]));
  assert.equal(out.toolCalls, 2);
  assert.equal(out.cost.calls, 4);
  assert.ok(Math.abs(out.cost.usd - 0.04) < 1e-9);
  assert.match(model.requests[3].turns.at(-1).text, /prechecks FAILED.*\n.*any/);
  assert.match(model.requests[2].turns.at(-1).text, /^\[tool result read_file\]/);
  assert.deepEqual(d.steps.map((s) => s.kind), ["tool", "tool", "precheck_failed", "propose"]);
  assert.ok(out.draft.checks.some((c) => /hamza-ci/.test(c)));
});

test("reply ends the loop; invalid JSON gets one corrective turn", async () => {
  const model = scripted(["not json", { action: "reply", replyAr: "أي صفحة؟" }]);
  const out = await runAgentLoop(deps(model).value, limits, { system: "s", turns: [{ role: "user", text: "fix it" }] });
  assert.equal(out.kind, "reply");
  assert.equal(out.text, "أي صفحة؟");
  assert.match(model.requests[1].turns.at(-1).text, /ONE JSON object/);
});

test("tool budget: extra tool calls are refused, not executed", async () => {
  const model = scripted([
    ...Array.from({ length: 4 }, () => ({ action: "tool", tool: "list_tree", args: {} })),
    { action: "reply", replyAr: "ok" },
  ]);
  const out = await runAgentLoop(deps(model).value, limits, { system: "s", turns: [{ role: "user", text: "x" }] });
  assert.equal(out.toolCalls, 3);
  assert.match(model.requests[4].turns.at(-1).text, /Tool budget \(3 calls\) is used up/);
});

test("task budget pauses with a resumable checkpoint; resume continues from it", async () => {
  const model = scripted([{ action: "tool", tool: "list_tree", args: {} }, { action: "tool", tool: "list_tree", args: {} }, goodPatch], 1.5);
  const d = deps(model);
  const paused = await runAgentLoop(d.value, limits, { system: "s", turns: [{ role: "user", text: "x" }] });
  assert.equal(paused.kind, "paused");
  assert.equal(paused.reason, "task_budget");
  assert.equal(paused.checkpoint.steps, 2);
  const resumed = await runAgentLoop(d.value, { ...limits, taskCapUsd: 5 }, { system: "s", turns: [], resume: paused.checkpoint });
  assert.equal(resumed.kind, "proposal");
  assert.ok(Math.abs(resumed.cost.usd - 4.5) < 1e-9);
});

test("month cap, cancel, timeout, step limit, model failure and repeated precheck failure all stop safely", async () => {
  const monthly = await runAgentLoop(deps(scripted([goodPatch])).value, limits, { system: "s", turns: [] }).catch((e) => e);
  assert.equal(monthly.kind, "proposal");
  const month = await runAgentLoop({ ...deps(scripted([goodPatch])).value, monthSpentUsd: async () => 60 }, limits, { system: "s", turns: [] });
  assert.equal(month.reason, "month_budget");
  const cancelled = await runAgentLoop({ ...deps(scripted([goodPatch])).value, isCancelled: async () => true }, limits, { system: "s", turns: [] });
  assert.equal(cancelled.reason, "cancelled");
  const timeout = await runAgentLoop(deps(scripted(Array.from({ length: 20 }, () => ({ action: "tool", tool: "list_tree" }))), {}).value, { ...limits, timeoutMs: 2500, maxToolCalls: 40 }, { system: "s", turns: [] });
  assert.equal(timeout.reason, "timeout");
  const steps = await runAgentLoop(deps(scripted(Array.from({ length: 20 }, () => "nope"))).value, { ...limits, maxSteps: 3 }, { system: "s", turns: [] });
  assert.equal(steps.reason, "steps");
  const models = await runAgentLoop(deps(scripted([])).value, limits, { system: "s", turns: [] });
  assert.equal(models.reason, "models");
  const broken = { ...goodPatch, patch: [{ op: "edit", path: "src/components/Hello.tsx", edits: [{ search: "missing", replace: "x" }] }] };
  const pre = await runAgentLoop(deps(scripted([broken, broken, broken])).value, limits, { system: "s", turns: [] });
  assert.equal(pre.reason, "prechecks");
  assert.match(pre.message, /matched 0 times/);
});

test("protocol parsing and context compaction", () => {
  assert.equal(parseAgentAction(null).action, "invalid");
  assert.equal(parseAgentAction({ action: "tool" }).action, "invalid");
  assert.equal(parseAgentAction({ action: "propose", patch: [{ op: "x" }] }).rawOps, 1);
  const turns = Array.from({ length: 14 }, (_, i) => ({ role: "user", text: `[tool result t${i}]\n${"x".repeat(1000)}` }));
  const compacted = compactTurns(turns);
  assert.match(compacted[0].text, /shortened/);
  assert.equal(compacted[13].text, turns[13].text);
  assert.equal(compacted.filter((t) => /shortened/.test(t.text)).length, 4);
});
