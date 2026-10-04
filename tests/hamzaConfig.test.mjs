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
