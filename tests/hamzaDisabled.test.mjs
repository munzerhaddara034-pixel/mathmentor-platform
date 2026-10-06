// Hamza is DISABLED by default: without GITHUB_TOKEN or any required HAMZA_* setting there is no worker,
// no task, no model call, no approval / PR / merge action, a "not configured" UI state, and no crash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeHamzaReadiness, hamzaReadiness, hamzaRuntimeConfig, setHamzaReadinessOverride } from "../src/lib/hamza/readiness.ts";
import { hamzaWorkerTick } from "../src/lib/hamza/worker.ts";

const FULL = {
  HAMZA_ENABLED: "1",
  GITHUB_TOKEN: "test-placeholder-not-a-token",
  GITHUB_OWNER: "munzerhaddara034-pixel",
  GITHUB_REPO: "mathmentor-platform",
  HAMZA_BASE_BRANCH: "agent-hub-latest",
  HAMZA_MODEL_PRIMARY: "gemini-3.1-pro-preview",
  GEMINI_API_KEY: "test-placeholder-key",
};
const REQUIRED = ["HAMZA_ENABLED", "GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "HAMZA_BASE_BRANCH", "HAMZA_MODEL_PRIMARY"];
const ENV_KEYS = [...REQUIRED, "GEMINI_API_KEY", "HAMZA_GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "HAMZA_WORKER"];

/** Run fn with the given env (all Hamza-related keys cleared first), then restore. */
async function withEnv(vars, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("readiness: empty env → disabled, every required name listed (names only)", () => {
  const r = computeHamzaReadiness({});
  assert.equal(r.ready, false);
  for (const name of ["HAMZA_ENABLED=1", "GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "HAMZA_BASE_BRANCH", "HAMZA_MODEL_PRIMARY"]) {
    assert.ok(r.missing.includes(name), `${name} missing from ${r.missing.join(",")}`);
  }
});

test("readiness: fully configured → ready; removing ANY one required var disables Hamza", () => {
  assert.deepEqual(computeHamzaReadiness(FULL), { ready: true, missing: [] });
  for (const key of REQUIRED) {
    const env = { ...FULL };
    delete env[key];
    const r = computeHamzaReadiness(env);
    assert.equal(r.ready, false, `${key} removed must disable`);
    assert.equal(r.missing.length, 1, `${key}: ${r.missing.join(",")}`);
    assert.ok(r.missing[0].startsWith(key));
  }
  assert.equal(computeHamzaReadiness({ ...FULL, GITHUB_TOKEN: "   " }).ready, false, "blank token");
});

test("readiness: HAMZA_ENABLED must be an explicit opt-in; 0 is the kill switch", () => {
  for (const value of ["0", "", "no", "false", "maybe"]) assert.equal(computeHamzaReadiness({ ...FULL, HAMZA_ENABLED: value }).ready, false, value);
  for (const value of ["1", "true", "on"]) assert.equal(computeHamzaReadiness({ ...FULL, HAMZA_ENABLED: value }).ready, true, value);
});

test("readiness: primary model needs its own key; invalid branch / model ids do not count", () => {
  const noKey = { ...FULL };
  delete noKey.GEMINI_API_KEY;
  assert.deepEqual(computeHamzaReadiness(noKey).missing, ["HAMZA_GEMINI_API_KEY or GEMINI_API_KEY"]);
  assert.equal(computeHamzaReadiness({ ...noKey, HAMZA_GEMINI_API_KEY: "k" }).ready, true);
  assert.deepEqual(computeHamzaReadiness({ ...FULL, HAMZA_MODEL_PRIMARY: "openai:gpt-5.3-codex" }).missing, ["OPENAI_API_KEY"]);
  assert.equal(computeHamzaReadiness({ ...FULL, HAMZA_MODEL_PRIMARY: "openai:gpt-5.3-codex", OPENAI_API_KEY: "k" }).ready, true);
  assert.deepEqual(computeHamzaReadiness({ ...FULL, HAMZA_BASE_BRANCH: "../main" }).missing, ["HAMZA_BASE_BRANCH"]);
  assert.deepEqual(computeHamzaReadiness({ ...FULL, HAMZA_MODEL_PRIMARY: "@@@" }).missing, ["HAMZA_MODEL_PRIMARY"]);
});

test("runtime config: enabled is forced off when not configured (worker ticks + enqueue use it)", async () => {
  setHamzaReadinessOverride(null);
  await withEnv({ HAMZA_ENABLED: "1", HAMZA_MODEL_PRIMARY: "gemini-3.1-pro-preview" }, () => {
    assert.equal(hamzaReadiness().ready, false);
    assert.ok(hamzaReadiness().missing.includes("GITHUB_TOKEN"));
    assert.equal(hamzaRuntimeConfig().enabled, false);
  });
  await withEnv(FULL, () => {
    assert.equal(hamzaReadiness().ready, true);
    assert.equal(hamzaRuntimeConfig().enabled, true);
  });
});

test("worker: a tick with the disabled runtime config claims nothing and polls nothing", async () => {
  await withEnv({}, async () => {
    const boom = () => {
      throw new Error("must not be called while Hamza is disabled");
    };
    const deps = {
      config: hamzaRuntimeConfig(),
      tasks: { claimNext: boom },
      teamRepo: { listProposalsByStatus: boom },
      now: () => new Date(),
      runner: boom,
      refreshCi: boom,
    };
    assert.deepEqual(await hamzaWorkerTick(deps), { polled: 0, errors: [] });
  });
});

test("startup: no worker without GITHUB_TOKEN / HAMZA_* (no crash), log lists names never values", async () => {
  const { startHamzaIfConfigured } = await import("../src/instrumentation-node.ts");
  const logs = [];
  const info = console.info;
  console.info = (...args) => logs.push(args.join(" "));
  try {
    for (const env of [{}, { ...FULL, GITHUB_TOKEN: "" }, { ...FULL, HAMZA_ENABLED: "0" }, { ...FULL, HAMZA_MODEL_PRIMARY: "" }]) {
      const started = await withEnv(Object.fromEntries(Object.entries(env).filter(([, v]) => v)), () => startHamzaIfConfigured());
      assert.equal(started, false);
    }
  } finally {
    console.info = info;
  }
  assert.equal(globalThis.mmHamzaWorker, undefined, "no background interval was created");
  assert.ok(logs.every((line) => line.includes("Hamza disabled (not configured")), logs.join("\n"));
  assert.ok(logs.every((line) => !line.includes(FULL.GITHUB_TOKEN) && !line.includes(FULL.GEMINI_API_KEY)), "secret values never logged");
});

test("writer: octokitWriter refuses when Hamza is not configured, even with a token", async () => {
  const { octokitWriter } = await import("../src/lib/hamza/github/octokit.ts");
  await withEnv({ GITHUB_TOKEN: FULL.GITHUB_TOKEN }, () => {
    assert.throws(() => octokitWriter({ owner: "o", repo: "r" }), /not configured/);
  });
  await withEnv({}, () => {
    assert.throws(() => octokitWriter({ owner: "o", repo: "r" }), /GITHUB_TOKEN/);
  });
});

test("decisions: every action except reject returns 503 while not configured (before any store / GitHub access)", async () => {
  const { decideProposal } = await import("../src/lib/team/approval.ts");
  const actor = { id: "u1", name: "Munzer", email: "munzerhaddara2@gmail.com", role: "admin" };
  await withEnv({}, async () => {
    for (const action of ["issue_code", "approve", "merge", "refresh_ci", "revise", "revert"]) {
      const result = await decideProposal({ proposalId: "prop-does-not-exist", action, confirm: true, code: "HMZ-AAAAAA", typedBranch: "agent-hub-latest", text: "x", actor });
      assert.equal(result.ok, false, action);
      assert.equal(result.status, 503, action);
      assert.match(result.error, /not configured/);
      assert.ok(!result.error.includes(FULL.GITHUB_TOKEN));
    }
  });
});

test("chat: حمزة replies with a fixed notice and never enqueues / calls a model when not configured", () => {
  const agents = readFileSync(new URL("../src/lib/team/agents.ts", import.meta.url), "utf8");
  const gate = agents.indexOf("const readiness = hamzaReadiness();");
  assert.ok(gate > 0, "readiness gate present in runAgent");
  assert.ok(gate < agents.indexOf("looksLikeApprovalText(human.text)"), "gate runs before the approval-text reply");
  assert.ok(gate < agents.indexOf("await enqueueHamzaTask("), "gate runs before enqueue");
});

test("routes + UI: not-configured state is exposed (names only) and shown; continue is gated", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("src/app/api/admin/team/messages/route.ts"), /hamza: hamzaReadiness\(\)/);
  assert.match(read("src/app/api/admin/team/hamza/activity/route.ts"), /hamza: hamzaReadiness\(\)/);
  assert.match(read("src/app/api/admin/team/tasks/[id]/route.ts"), /action === "continue" && !hamzaReadiness\(\)\.ready\) return teamError\(503/);
  const chat = read("src/components/admin/team/TeamChat.tsx");
  assert.match(chat, /hamza && !hamza\.ready/);
  assert.match(chat, /t\.hamzaOffTitle/);
  const env = read(".env.example");
  assert.match(env, /^HAMZA_ENABLED=$/m, ".env.example does not opt in");
});
