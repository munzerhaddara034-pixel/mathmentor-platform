// Code-evolution lockdown: Path C (chat / voice executeCodeEvolution) disabled, Path B (Agent Hub /
// WhatsApp approvals) never commits, agents never write to main / agent-hub-latest / the live
// branch, and Hamza's typed-live-branch option is gone. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AGENT_HUB_CODE_COMMITS_ENABLED,
  CHAT_CODE_EVOLUTION_ENABLED,
  CODE_EVOLUTION_DISABLED_AR,
  agentCommitBranchCheck,
} from "../src/lib/security/agentBranches.ts";
import { executeCodeEvolution } from "../src/lib/agent/codeEvolutionAgent.ts";
import { commitCodeDirectly } from "../src/lib/agent/githubCommit.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("Path C: executeCodeEvolution refuses, never claims success, never touches the network", async () => {
  assert.equal(CHAT_CODE_EVOLUTION_ENABLED, false);
  const realFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = async () => {
    fetched += 1;
    throw new Error("network not allowed in this test");
  };
  try {
    const result = await executeCodeEvolution({ prompt: "غير عنوان الصفحة الرئيسية", branch: "agent-hub-latest" });
    assert.equal(result.success, false);
    assert.equal(result.disabled, true);
    assert.equal(result.messageAr, CODE_EVOLUTION_DISABLED_AR);
    assert.match(result.messageAr, /معطّل/);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(fetched, 0);
  const engine = src("lib/agent/codeEvolutionAgent.ts");
  assert.doesNotMatch(engine, /createOrUpdateFileContents|@octokit|GoogleGenAI/);
});

test("Path C routes (/api/bot, voice) reply 'disabled' and no longer say the change succeeded", () => {
  for (const route of ["app/api/bot/route.ts", "app/api/agent/whatsapp-voice/gemini/route.ts"]) {
    const code = src(route);
    assert.match(code, /code-evolution-disabled/, route);
    assert.match(code, /success: false/, route);
    assert.doesNotMatch(code, /أنجز المهندس|بنجاح 🚀|تم حفظ الـ Commit/, route);
  }
});

test("Path B: commitCodeDirectly is disabled (no GitHub call) and approvals skip code_evolution", async () => {
  assert.equal(AGENT_HUB_CODE_COMMITS_ENABLED, false);
  const res = await commitCodeDirectly({ filePath: "src/app/page.tsx", commitMessage: "x", newContent: "y" });
  assert.equal(res.ok, false);
  assert.equal(res.disabled, true);
  const wf = src("lib/agent/approvalWorkflow.ts");
  assert.match(wf, /item\.kind === "code_evolution" && !AGENT_HUB_CODE_COMMITS_ENABLED/);
  assert.match(wf, /i\.kind !== "code_evolution" \|\| AGENT_HUB_CODE_COMMITS_ENABLED/);
  const helper = src("lib/agent/githubCommit.ts");
  assert.match(helper, /agentCommitBranchCheck\(GITHUB_BRANCH\)/);
});

test("agent branch policy: only feat/fix/chore/docs, never main / master / agent-hub-latest / live", () => {
  for (const ok of ["feat/team-chat-x", "fix/login-typo", "chore/deps", "docs/readme"]) {
    assert.equal(agentCommitBranchCheck(ok, { liveBranch: "agent-hub-latest" }).ok, true, ok);
  }
  for (const bad of [
    "main",
    "master",
    "agent-hub-latest",
    "refs/heads/main",
    "cursor/platform-shell-auth-dashboard-2f19",
    "release-2026-10-01",
    "feat/",
    "feat/../main",
    "",
    "feature/x",
  ]) {
    assert.equal(agentCommitBranchCheck(bad, { liveBranch: "agent-hub-latest" }).ok, false, bad);
  }
  // Whatever Render's GITHUB_BRANCH is, it is refused even if it looks like feat/*.
  assert.equal(agentCommitBranchCheck("feat/live", { liveBranch: "feat/live" }).ok, false);
});

test("Hamza (/admin/team): no typed live-branch override; server enforces the branch policy", () => {
  const card = src("components/admin/team/ProposalCard.tsx");
  assert.doesNotMatch(card, /confirmBranch|target === "live"|typeLiveBranch/);
  assert.match(card, /agentCommitBranchCheck/);
  const approval = src("lib/team/approval.ts");
  assert.doesNotMatch(approval, /confirmBranch/);
  assert.match(approval, /agentCommitBranchCheck\(branch, \{ liveBranch: config\.baseBranch \}\)/);
  const route = src("app/api/admin/team/proposals/[id]/route.ts");
  assert.doesNotMatch(route, /confirmBranch/);
  // Hamza v2: writes moved to the pipeline's Octokit writer, which re-checks the policy on every write
  // (branch creation, commit, PR) and the pipeline checks it again before the code is accepted.
  const writer = src("lib/hamza/github/octokit.ts");
  assert.match(writer, /agentCommitBranchCheck\(branch, \{ liveBranch: config\.baseBranch\.branch \}\)/);
  assert.equal(writer.match(/assertAgentWritableBranch\((branch|head|pr\.headRef)\)/g)?.length, 4);
  const openPr = src("lib/hamza/pipeline/openPr.ts");
  assert.match(openPr, /agentCommitBranchCheck\(branch, \{ liveBranch: base \}\)/);
  assert.doesNotMatch(src("lib/team/github.ts"), /createRef|createCommit|updateRef/);
});

test("WhatsApp approvals need a verified webhook", () => {
  const route = src("app/api/agent/whatsapp-voice/route.ts");
  assert.match(route, /UNVERIFIED_PRIVILEGED_REFUSAL_AR/);
  assert.match(route, /privileged &&\n\s+parsed\.isWebhookStyle &&/);
});
