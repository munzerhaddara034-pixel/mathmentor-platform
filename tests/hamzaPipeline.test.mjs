// Hamza approval pipeline: code #1 → feat/* branch + PR, CI reported once, code #2 + typed branch → squash merge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { approveMerge, approveOpenPr, issueCode, refreshCi, rejectProposal } from "../src/lib/hamza/pipeline/index.ts";
import { publicProposal } from "../src/lib/hamza/publicProposal.ts";
import { isSameOriginRequest } from "../src/lib/hamza/sameOrigin.ts";
import { BASE_FILES, approver, fileChange, makeDeps, makeProposal, outsider, run } from "./support/hamzaFixtures.mjs";

const hello = BASE_FILES["src/components/Hello.tsx"];
const helloHi = hello.replace("Hello</p>", "Hi</p>");

async function pendingSetup(files = [fileChange("src/components/Hello.tsx", hello, helloHi)], options = {}) {
  const ctx = makeDeps(options);
  const proposal = makeProposal(files, options.proposal);
  await ctx.repo.saveProposal(proposal);
  return { ...ctx, proposal };
}

async function openPr(ctx) {
  const issued = await issueCode(ctx.deps, { proposalId: ctx.proposal.id, action: "open_pr", actor: approver });
  assert.ok(issued.ok, JSON.stringify(issued));
  const res = await approveOpenPr(ctx.deps, { proposalId: ctx.proposal.id, code: issued.code, reviewed: true, actor: approver });
  assert.ok(res.ok && res.proposal.status === "ci_running", JSON.stringify(res));
  return res.proposal;
}

test("approval #1: wrong code refused + audited; right code → feat/* branch, one commit, PR into the live branch", async () => {
  const ctx = await pendingSetup();
  const issued = await issueCode(ctx.deps, { proposalId: ctx.proposal.id, action: "open_pr", actor: approver });
  assert.ok(issued.ok && /^HMZ-/.test(issued.code));
  const wrong = await approveOpenPr(ctx.deps, { proposalId: ctx.proposal.id, code: "HMZ-AAAAAA", reviewed: true, actor: approver });
  assert.deepEqual([wrong.ok, wrong.status], [false, 403]);
  assert.equal((await ctx.repo.getProposal(ctx.proposal.id)).hamza.codes.open_pr.attempts, 1);
  assert.ok(ctx.audits.some((a) => a.action === "hamza.code.failed" && a.details.reason === "mismatch"));
  assert.equal(ctx.github.calls.length, 0, "no GitHub write before a valid code");

  const res = await approveOpenPr(ctx.deps, { proposalId: ctx.proposal.id, code: issued.code, reviewed: true, actor: approver });
  assert.ok(res.ok);
  assert.equal(res.proposal.status, "ci_running");
  assert.equal(res.proposal.hamza.prNumber, 1);
  assert.equal(ctx.github.prs.get(1).baseRef, "agent-hub-latest");
  assert.equal(ctx.github.prs.get(1).headRef, "feat/say-hi");
  assert.equal(ctx.github.treeOf("feat/say-hi").get("src/components/Hello.tsx"), helloHi);
  assert.equal(ctx.github.treeOf("agent-hub-latest").get("src/components/Hello.tsx"), hello, "live branch untouched");
  assert.deepEqual(ctx.github.calls.map((c) => c[0]), ["createBranch", "commitTree", "openPr"]);
  assert.ok(ctx.audits.some((a) => a.action === "hamza.approve.pr"));
  const opened = ctx.audits.find((a) => a.action === "hamza.pr.opened");
  assert.equal(opened.details.prNumber, 1);
  assert.equal(opened.ip, "10.0.0.1");
  assert.match(res.message.text, /PR #1/);
  // Single use: the same code cannot approve again.
  const again = await approveOpenPr(ctx.deps, { proposalId: ctx.proposal.id, code: issued.code, reviewed: true, actor: approver });
  assert.equal(again.ok, false);
});

test("gates: reviewed checkbox, approver list, stale code after a new revision, tampered live target", async () => {
  const ctx = await pendingSetup();
  assert.equal((await issueCode(ctx.deps, { proposalId: ctx.proposal.id, action: "open_pr", actor: outsider })).status, 403);
  const issued = await issueCode(ctx.deps, { proposalId: ctx.proposal.id, action: "open_pr", actor: approver });
  assert.equal((await approveOpenPr(ctx.deps, { proposalId: ctx.proposal.id, code: issued.code, reviewed: false, actor: approver })).status, 400);
  // New revision → the old code is stale.
  const stored = await ctx.repo.getProposal(ctx.proposal.id);
  await ctx.repo.saveProposal({ ...stored, hamza: { ...stored.hamza, revision: 2 } });
  const stale = await approveOpenPr(ctx.deps, { proposalId: ctx.proposal.id, code: issued.code, reviewed: true, actor: approver });
  assert.deepEqual([stale.ok, stale.status], [false, 409]);
  assert.match(stale.error, /revised/);
  // A stored proposal whose target was tampered to the live branch is refused before any write.
  const tampered = await pendingSetup(undefined, { proposal: { targetBranch: "agent-hub-latest" } });
  const code = await issueCode(tampered.deps, { proposalId: tampered.proposal.id, action: "open_pr", actor: approver });
  const refused = await approveOpenPr(tampered.deps, { proposalId: tampered.proposal.id, code: code.code, reviewed: true, actor: approver });
  assert.deepEqual([refused.ok, refused.status], [false, 403]);
  assert.equal(tampered.github.calls.length, 0);
  // Branch override at code issuance follows the same policy.
  assert.equal((await issueCode(tampered.deps, { proposalId: tampered.proposal.id, action: "open_pr", actor: approver, branch: "main" })).status, 403);
});

test("conflict guard: base changed since the diff → failed, nothing committed, retry possible", async () => {
  const ctx = await pendingSetup();
  ctx.github.pushToBase("src/components/Hello.tsx", "export const changed = true;\n");
  const issued = await issueCode(ctx.deps, { proposalId: ctx.proposal.id, action: "open_pr", actor: approver });
  const res = await approveOpenPr(ctx.deps, { proposalId: ctx.proposal.id, code: issued.code, reviewed: true, actor: approver });
  assert.ok(res.ok);
  assert.equal(res.proposal.status, "failed");
  assert.match(res.proposal.error, /تغيّر/);
  assert.ok(!ctx.github.calls.some((c) => c[0] === "commitTree" || c[0] === "openPr"));
});

test("multi-file patch: delete + rename become one atomic tree write", async () => {
  const ctx = await pendingSetup([
    fileChange("src/lib/old.ts", BASE_FILES["src/lib/old.ts"], "", { change: "delete", newContent: "" }),
    { ...fileChange("docs/guide.md", BASE_FILES["docs/notes.md"], "# Notes\n"), change: "rename", oldPath: "docs/notes.md" },
  ]);
  await openPr(ctx);
  const commit = ctx.github.calls.find((c) => c[0] === "commitTree");
  assert.deepEqual(commit[2], ["D src/lib/old.ts", "D docs/notes.md", "W docs/guide.md"]);
  const tree = ctx.github.treeOf("feat/say-hi");
  assert.equal(tree.has("src/lib/old.ts"), false);
  assert.equal(tree.has("docs/notes.md"), false);
  assert.equal(tree.get("docs/guide.md"), "# Notes\n");
});

test("CI: running → passed is posted once; failure posts the first error lines and calls the repair hook", async () => {
  let repairs = 0;
  const ctx = await pendingSetup(undefined, { onCiFailed: async () => ((repairs += 1), "🔧 جولة إصلاح 1/2") });
  const opened = await openPr(ctx);
  const head = opened.hamza.headSha;
  ctx.github.setChecks(head, [run(5, "hamza-ci", "in_progress", null)]);
  let r = await refreshCi(ctx.deps, { proposalId: opened.id });
  assert.ok(r.ok && r.proposal.status === "ci_running" && !r.message);
  ctx.github.setChecks(head, [run(5, "hamza-ci", "completed", "failure")]);
  ctx.github.setLog(5, "2026-10-04T20:01:00.0000000Z src/a.ts(1,1): error TS2304: Cannot find name 'x'.\n");
  r = await refreshCi(ctx.deps, { proposalId: opened.id });
  assert.equal(r.proposal.status, "ci_failed");
  assert.match(r.message.text, /❌ فشل فحص CI/);
  assert.match(r.message.text, /error TS2304/);
  assert.match(r.message.text, /جولة إصلاح 1\/2/);
  assert.equal(repairs, 1);
  r = await refreshCi(ctx.deps, { proposalId: opened.id });
  assert.ok(!r.message, "same result is not reported twice");
  assert.equal(repairs, 1);
  ctx.github.setChecks(head, [run(5, "hamza-ci", "completed", "failure"), run(6, "hamza-ci", "completed", "success")]);
  r = await refreshCi(ctx.deps, { proposalId: opened.id });
  assert.equal(r.proposal.status, "ci_passed");
  assert.match(r.message.text, /✅ نجح فحص CI/);
  assert.ok(ctx.audits.filter((a) => a.action === "hamza.ci.result").length === 2);
});

test("approval #2: only on green CI, separate code, typed live branch, exact head → squash merge", async () => {
  const ctx = await pendingSetup();
  const opened = await openPr(ctx);
  assert.equal((await issueCode(ctx.deps, { proposalId: opened.id, action: "merge", actor: approver })).status, 409, "no merge code before CI");
  ctx.github.setChecks(opened.hamza.headSha, [run(9, "hamza-ci", "completed", "success")]);
  await refreshCi(ctx.deps, { proposalId: opened.id });
  const code = await issueCode(ctx.deps, { proposalId: opened.id, action: "merge", actor: approver });
  assert.ok(code.ok);
  assert.equal((await approveMerge(ctx.deps, { proposalId: opened.id, code: code.code, typedBranch: "main", actor: approver })).status, 400);
  assert.equal((await approveMerge(ctx.deps, { proposalId: opened.id, code: code.code, typedBranch: "agent-hub-latest", actor: outsider })).status, 403);
  const merged = await approveMerge(ctx.deps, { proposalId: opened.id, code: code.code, typedBranch: "agent-hub-latest", actor: approver });
  assert.ok(merged.ok && merged.proposal.status === "merged", JSON.stringify(merged));
  assert.equal(ctx.github.treeOf("agent-hub-latest").get("src/components/Hello.tsx"), helloHi);
  assert.deepEqual(ctx.github.calls.at(-1), ["mergePr", 1, opened.hamza.headSha]);
  assert.ok(ctx.audits.some((a) => a.action === "hamza.approve.merge") && ctx.audits.some((a) => a.action === "hamza.merged"));
  assert.match(merged.message.text, /دُمج PR #1/);
});

test("approval #2 refuses when the PR head moved after CI (back to CI)", async () => {
  const ctx = await pendingSetup();
  const opened = await openPr(ctx);
  ctx.github.setChecks(opened.hamza.headSha, [run(9, "hamza-ci", "completed", "success")]);
  await refreshCi(ctx.deps, { proposalId: opened.id });
  const code = await issueCode(ctx.deps, { proposalId: opened.id, action: "merge", actor: approver });
  await ctx.github.commitTree({ branch: "feat/say-hi", parentSha: opened.hamza.headSha, message: "sneaky", files: [{ path: "src/x.ts", content: "x\n" }] });
  const res = await approveMerge(ctx.deps, { proposalId: opened.id, code: code.code, typedBranch: "agent-hub-latest", actor: approver });
  assert.deepEqual([res.ok, res.status], [false, 409]);
  assert.equal((await ctx.repo.getProposal(opened.id)).status, "ci_running");
  assert.ok(!ctx.github.calls.some((c) => c[0] === "mergePr"));
});

test("the open-PR code can never merge (codes are per step)", async () => {
  const ctx = await pendingSetup();
  const issued = await issueCode(ctx.deps, { proposalId: ctx.proposal.id, action: "open_pr", actor: approver });
  await approveOpenPr(ctx.deps, { proposalId: ctx.proposal.id, code: issued.code, reviewed: true, actor: approver });
  const p = await ctx.repo.getProposal(ctx.proposal.id);
  ctx.github.setChecks(p.hamza.headSha, [run(1, "hamza-ci", "completed", "success")]);
  await refreshCi(ctx.deps, { proposalId: p.id });
  const res = await approveMerge(ctx.deps, { proposalId: p.id, code: issued.code, typedBranch: "agent-hub-latest", actor: approver });
  assert.deepEqual([res.ok, res.status], [false, 403]);
});

test("reject closes the PR without merging; browser view never carries code hashes", async () => {
  const ctx = await pendingSetup();
  const opened = await openPr(ctx);
  await issueCode(ctx.deps, { proposalId: opened.id, action: "open_pr", actor: approver }).catch(() => null);
  const res = await rejectProposal(ctx.deps, { proposalId: opened.id, actor: approver });
  assert.ok(res.ok && res.proposal.status === "rejected");
  assert.equal(ctx.github.prs.get(1).state, "closed");
  assert.equal(ctx.github.prs.get(1).merged, false);
  const fresh = await pendingSetup();
  await issueCode(fresh.deps, { proposalId: fresh.proposal.id, action: "open_pr", actor: approver });
  const stored = await fresh.repo.getProposal(fresh.proposal.id);
  assert.ok(stored.hamza.codes.open_pr.hash);
  const view = publicProposal(stored, new Date("2026-10-04T20:05:00Z"));
  assert.deepEqual(view.hamza.codes, {});
  assert.ok(view.hamza.activeCode.open_pr);
  assert.ok(!JSON.stringify(view).includes(stored.hamza.codes.open_pr.hash));
  assert.equal(publicProposal(stored, new Date("2026-10-04T21:00:00Z")).hamza.activeCode.open_pr, undefined);
});

test("CSRF: only same-origin browser requests", () => {
  const h = (o) => ({ get: (k) => o[k] ?? null });
  assert.equal(isSameOriginRequest(h({ "sec-fetch-site": "same-origin" })), true);
  assert.equal(isSameOriginRequest(h({ "sec-fetch-site": "cross-site", origin: "https://mm.example", host: "mm.example" })), false);
  assert.equal(isSameOriginRequest(h({ origin: "https://mm.example", host: "mm.example" })), true);
  assert.equal(isSameOriginRequest(h({ origin: "https://evil.example", host: "mm.example" })), false);
  assert.equal(isSameOriginRequest(h({})), false);
});

test("GitHub write APIs are referenced only by the Hamza Octokit writer (and the disabled legacy helper)", () => {
  const root = new URL("../src/", import.meta.url).pathname;
  const allowed = new Set(["lib/hamza/github/octokit.ts", "lib/agent/githubCommit.ts"]);
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) {
        const rel = path.relative(root, full);
        const code = readFileSync(full, "utf8");
        if (/\.(createRef|createCommit|updateRef|createTree|createOrUpdateFileContents|deleteFile)\(|pulls\.(merge|create)\(/.test(code) && !allowed.has(rel)) offenders.push(rel);
      }
    }
  };
  walk(root);
  assert.deepEqual(offenders, []);
});
