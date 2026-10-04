// Hamza base branch: one setting (HAMZA_BASE_BRANCH) with one meaning; GITHUB_BRANCH is a legacy fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HAMZA_BASE_BRANCH, hamzaBaseBranch, hamzaLiveBranches } from "../src/lib/hamza/config.ts";

test("HAMZA_BASE_BRANCH wins over the legacy GITHUB_BRANCH", () => {
  const r = hamzaBaseBranch({ HAMZA_BASE_BRANCH: "agent-hub-latest", GITHUB_BRANCH: "cursor/platform-shell-auth-dashboard-2f19" });
  assert.deepEqual(r, { branch: "agent-hub-latest", source: "HAMZA_BASE_BRANCH" });
});

test("legacy GITHUB_BRANCH is used (with a warning) only when HAMZA_BASE_BRANCH is unset", () => {
  const r = hamzaBaseBranch({ GITHUB_BRANCH: " cursor/platform-shell-auth-dashboard-2f19 " });
  assert.equal(r.branch, "cursor/platform-shell-auth-dashboard-2f19");
  assert.equal(r.source, "GITHUB_BRANCH");
  assert.match(r.warning ?? "", /HAMZA_BASE_BRANCH/);
});

test("default is agent-hub-latest, never main; invalid names fall through", () => {
  assert.equal(DEFAULT_HAMZA_BASE_BRANCH, "agent-hub-latest");
  assert.equal(hamzaBaseBranch({}).branch, "agent-hub-latest");
  assert.equal(hamzaBaseBranch({}).source, "default");
  const bad = hamzaBaseBranch({ HAMZA_BASE_BRANCH: "../main", GITHUB_BRANCH: "" });
  assert.equal(bad.branch, "agent-hub-latest");
  assert.match(bad.warning ?? "", /not a valid branch/);
});

test("live branches = base + legacy GITHUB_BRANCH (both protected from direct writes)", () => {
  assert.deepEqual(hamzaLiveBranches({ HAMZA_BASE_BRANCH: "agent-hub-latest", GITHUB_BRANCH: "feat/old-live" }), [
    "agent-hub-latest",
    "feat/old-live",
  ]);
  assert.deepEqual(hamzaLiveBranches({ HAMZA_BASE_BRANCH: "agent-hub-latest" }), ["agent-hub-latest"]);
});

import { hamzaConfig, parseModelSpec, parseModelList } from "../src/lib/hamza/config.ts";

test("model specs come from env: provider prefix or inferred from the id", () => {
  assert.deepEqual(parseModelSpec("gemini:gemini-3.1-pro-preview"), { provider: "gemini", model: "gemini-3.1-pro-preview", id: "gemini:gemini-3.1-pro-preview" });
  assert.equal(parseModelSpec("openai:gpt-5.3-codex")?.provider, "openai");
  assert.equal(parseModelSpec("gpt-5.3-codex")?.provider, "openai");
  assert.equal(parseModelSpec("gemini-3.8-flash")?.provider, "gemini");
  assert.equal(parseModelSpec("bad model; rm -rf"), null);
  assert.deepEqual(
    parseModelList("gemini-3.8-flash, openai:gpt-5.3-codex gemini-3.8-flash").map((m) => m.id),
    ["gemini:gemini-3.8-flash", "openai:gpt-5.3-codex"],
  );
});

test("defaults: $2/task, $5 max, $60/month, 2 repair rounds, 30-minute codes, hamza-ci check", () => {
  const c = hamzaConfig({});
  assert.equal(c.enabled, true);
  assert.deepEqual(c.budgets, { taskUsd: 2, taskMaxUsd: 5, monthlyUsd: 60 });
  assert.equal(c.maxRepairRounds, 2);
  assert.equal(c.codeTtlMinutes, 30);
  assert.equal(c.maxCodeAttempts, 5);
  assert.deepEqual(c.ciChecks, ["hamza-ci"]);
  assert.equal(c.models.configured, false);
  assert.equal(c.models.primary.length, 0);
});

test("env overrides; kill switch; repair rounds can only be lowered", () => {
  const c = hamzaConfig({
    HAMZA_ENABLED: "0",
    HAMZA_TASK_BUDGET_USD: "1.5",
    HAMZA_MONTHLY_BUDGET_USD: "40",
    HAMZA_MAX_REPAIR_ROUNDS: "9",
    HAMZA_MODEL_PRIMARY: "gemini-3.1-pro-preview",
    HAMZA_MODEL_FALLBACKS: "gemini-3.8-flash,openai:gpt-5.3-codex",
    HAMZA_CI_CHECKS: "hamza-ci, build",
    HAMZA_MERGE_APPROVER_EMAILS: "Munzer@Example.com",
  });
  assert.equal(c.enabled, false);
  assert.equal(c.budgets.taskUsd, 1.5);
  assert.equal(c.budgets.monthlyUsd, 40);
  assert.equal(c.maxRepairRounds, 2);
  assert.equal(c.models.configured, true);
  assert.equal(c.models.fallbacks.length, 2);
  assert.deepEqual(c.ciChecks, ["hamza-ci", "build"]);
  assert.deepEqual(c.mergeApproverEmails, ["munzer@example.com"]);
  assert.equal(hamzaConfig({ HAMZA_MAX_REPAIR_ROUNDS: "0" }).maxRepairRounds, 0);
});
