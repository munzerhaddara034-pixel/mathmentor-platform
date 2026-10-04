import { test } from "node:test";
import assert from "node:assert/strict";
import { hamzaConfig } from "../src/lib/hamza/config.ts";
import { approveOpenPr, issueCode } from "../src/lib/hamza/pipeline/index.ts";
import { runHamzaTask } from "../src/lib/hamza/runner/runTask.ts";
import { memorySnapshot } from "../src/lib/hamza/snapshot.ts";
import { claimIn, emptyTaskStore, memoryTaskRepo } from "../src/lib/hamza/tasks/engine.ts";
import { cancelHamzaTask, continueHamzaTask, enqueueHamzaTask } from "../src/lib/hamza/tasks/enqueue.ts";
import { publicTask } from "../src/lib/hamza/tasks/types.ts";
import { hamzaWorkerTick } from "../src/lib/hamza/worker.ts";
import { gitBlobSha } from "./support/fakeGithub.mjs";
import { approver, makeDeps } from "./support/hamzaFixtures.mjs";

const config = hamzaConfig({ HAMZA_BASE_BRANCH: "agent-hub-latest" });
const now = new Date("2026-10-04T20:00:00Z");
const actor = { id: "u-munzer", name: "Munzer", email: approver.email, role: "admin" };

function taskDeps(overrides = {}) {
  const audits = [];
  return { audits, deps: { tasks: memoryTaskRepo(), config, audit: async (action, input) => audits.push({ action, ...input }), now: () => now, ...overrides } };
}

const enqueueInput = { channel: "developer", kind: "new", requestText: "غيّر التحية", actor, turns: [{ role: "user", text: "غيّر التحية" }], replyToId: "tmsg-h1" };

test("engine: FIFO claim, lease, crash recovery once, then failed", () => {
  const store = emptyTaskStore();
  const base = { channel: "developer", kind: "new", requestText: "x", requestedBy: "M", requestedById: "u", turns: [], cost: { usd: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, calls: 0, models: [] }, capUsd: 2, estimateUsd: 0.25, progress: { steps: 0, toolCalls: 0 }, attempt: 0, updatedAt: "" };
  store.tasks.push({ ...base, id: "b", status: "queued", createdAt: "2026-10-04T20:00:02Z" }, { ...base, id: "a", status: "queued", createdAt: "2026-10-04T20:00:01Z" });
  const first = claimIn(store, "w1", now, 60_000);
  assert.equal(first.id, "a");
  assert.equal(first.attempt, 1);
  assert.equal(claimIn(store, "w2", now, 60_000).id, "b");
  assert.equal(claimIn(store, "w2", now, 60_000), undefined, "leases are respected");
  const later = new Date(now.getTime() + 61_000);
  assert.equal(claimIn(store, "w3", later, 60_000).attempt, 2, "expired lease is re-claimed");
  const muchLater = new Date(now.getTime() + 200_000);
  claimIn(store, "w4", muchLater, 60_000);
  assert.equal(store.tasks.find((t) => t.id === "a").status, "failed");
});

test("enqueue: disabled, one active task per channel, monthly cap, audit; public view hides server fields", async () => {
  const off = taskDeps({ config: hamzaConfig({ HAMZA_ENABLED: "0" }) });
  assert.equal((await enqueueHamzaTask(off.deps, enqueueInput)).reason, "disabled");
  const t = taskDeps();
  const queued = await enqueueHamzaTask(t.deps, enqueueInput);
  assert.equal(queued.ok, true);
  assert.equal(queued.task.capUsd, 2);
  assert.match(queued.text, /الحد \$2\.00/);
  assert.equal(t.audits[0].action, "hamza.task.created");
  const busy = await enqueueHamzaTask(t.deps, enqueueInput);
  assert.equal(busy.reason, "busy");
  assert.equal((await enqueueHamzaTask(t.deps, { ...enqueueInput, channel: "team" })).ok, true);
  const view = publicTask(queued.task);
  assert.ok(!("turns" in view) && !("checkpoint" in view) && !("extraContext" in view));
  const broke = taskDeps();
  broke.deps.tasks.store.tasks.push({ ...queued.task, id: "old", status: "done", cost: { ...queued.task.cost, usd: 60 } });
  const capped = await enqueueHamzaTask(broke.deps, enqueueInput);
  assert.equal(capped.reason, "month_budget");
  assert.equal(broke.audits[0].action, "hamza.budget.stop");
});

test("cancel (queued → cancelled, running → cancelRequested) and continue (task-cap pause only, up to $5)", async () => {
  const t = taskDeps();
  const { task } = await enqueueHamzaTask(t.deps, enqueueInput);
  assert.equal((await cancelHamzaTask(t.deps, task.id, actor)).status, "cancelled");
  const { task: second } = await enqueueHamzaTask(t.deps, enqueueInput);
  await t.deps.tasks.claimNext("w", now, 60_000);
  const flagged = await cancelHamzaTask(t.deps, second.id, actor);
  assert.equal(flagged.status, "running");
  assert.equal(flagged.cancelRequested, true);
  await t.deps.tasks.update(second.id, null, { status: "budget_paused", pauseReason: "task_budget", cancelRequested: false });
  const raised = await continueHamzaTask(t.deps, second.id, actor);
  assert.equal(raised.status, "queued");
  assert.equal(raised.capUsd, 5);
  assert.ok(t.audits.some((a) => a.action === "hamza.budget.raised"));
  await t.deps.tasks.update(second.id, null, { status: "budget_paused", pauseReason: "task_budget" });
  assert.equal(await continueHamzaTask(t.deps, second.id, actor), undefined, "already at the max cap");
});

function scriptedCall(answers) {
  return async () => {
    const next = answers.shift();
    if (!next) throw new Error("script exhausted");
    return { text: JSON.stringify(next), json: next, model: "gemini:test", usage: { inputTokens: 1000, cachedTokens: 0, outputTokens: 100 }, usd: 0.02, attempts: [] };
  };
}

function runnerFor(fixture, tasks, answers) {
  return {
    teamRepo: fixture.repo,
    tasks,
    config: fixture.deps.config,
    audit: fixture.deps.audit,
    now: fixture.deps.now,
    reader: () => fixture.github,
    openSnapshot: async (ref) => memorySnapshot(Object.fromEntries(fixture.github.treeOf(ref)), { sha: fixture.github.branches.get(ref), ref, shaOf: gitBlobSha }),
    call: scriptedCall(answers),
    systemPrompt: "أنت حمزة",
    repoLabel: "test/repo",
    syntax: async () => ({ ran: true, errors: [] }),
  };
}

const helloPatch = (to) => ({
  action: "propose",
  summaryAr: "تحية",
  commitMessage: "feat: greet",
  branch: "feat/greet",
  replyAr: "جاهز",
  patch: [{ op: "edit", path: "src/components/Hello.tsx", edits: [{ search: to.from, replace: to.to }] }],
});

test("runner: queued task → proposal on the exact base SHA → Approval #1 opens the PR; then a revision on the PR head", async () => {
  const fixture = makeDeps();
  const tasks = memoryTaskRepo();
  const t = { tasks, config: fixture.deps.config, audit: fixture.deps.audit, now: fixture.deps.now };
  const { task } = await enqueueHamzaTask(t, enqueueInput);
  const claimed = await tasks.claimNext("w", fixture.deps.now(), 60_000);
  await runHamzaTask(runnerFor(fixture, tasks, [{ action: "tool", tool: "read_file", args: { path: "src/components/Hello.tsx" } }, helloPatch({ from: "Hello</p>", to: "Hi</p>" })]), claimed);
  const done = await tasks.get(task.id);
  assert.equal(done.status, "done");
  assert.equal(done.progress.toolCalls, 1);
  assert.ok(Math.abs(done.cost.usd - 0.04) < 1e-9);
  assert.equal((await tasks.listSteps(task.id, 10)).length, 2);
  const proposal = await fixture.repo.getProposal(done.result.proposalId);
  assert.equal(proposal.targetBranch, "feat/greet");
  assert.equal(proposal.hamza.baseCommitSha, fixture.github.branches.get("agent-hub-latest"));
  assert.equal(proposal.hamza.taskId, task.id);
  const card = fixture.repo.messages.find((m) => m.proposalId === proposal.id);
  assert.equal(card.authorId, "developer");
  assert.equal(card.taskId, task.id);
  assert.ok(fixture.audits.some((a) => a.action === "hamza.proposal.created"));

  const code = await issueCode(fixture.deps, { proposalId: proposal.id, action: "open_pr", actor: approver });
  const opened = await approveOpenPr(fixture.deps, { proposalId: proposal.id, code: code.code, reviewed: true, actor: approver });
  assert.equal(opened.ok && opened.proposal.status, "ci_running");

  const rev = await enqueueHamzaTask(t, { ...enqueueInput, kind: "revision", proposalId: proposal.id, requestText: "خليها Hey" });
  const claimedRev = await tasks.claimNext("w", fixture.deps.now(), 60_000);
  await runHamzaTask(runnerFor(fixture, tasks, [helloPatch({ from: "Hi</p>", to: "Hey</p>" })]), claimedRev);
  assert.equal((await tasks.get(rev.task.id)).status, "done");
  const revised = await fixture.repo.getProposal(proposal.id);
  assert.equal(revised.status, "pending");
  assert.equal(revised.hamza.revision, 2);
  assert.deepEqual(revised.hamza.codes, {});
  assert.equal(revised.hamza.prNumber, opened.proposal.hamza.prNumber, "same PR");
  assert.equal(revised.files[0].baseSha, gitBlobSha('export function Hello() {\n  return <p>Hi</p>;\n}\n'), "relative to the PR head");
  assert.ok(revised.hamza.timeline.some((e) => e.kind === "revised"));
  const code2 = await issueCode(fixture.deps, { proposalId: proposal.id, action: "open_pr", actor: approver });
  const updated = await approveOpenPr(fixture.deps, { proposalId: proposal.id, code: code2.code, reviewed: true, actor: approver });
  assert.equal(updated.ok && updated.proposal.status, "ci_running");
  assert.equal(fixture.github.treeOf("feat/greet").get("src/components/Hello.tsx"), 'export function Hello() {\n  return <p>Hey</p>;\n}\n');
  assert.ok(fixture.audits.some((a) => a.action === "hamza.pr.updated"));
});

test("runner: budget pause stores a checkpoint and posts the continue hint; snapshot errors fail the task safely", async () => {
  const fixture = makeDeps();
  const tasks = memoryTaskRepo();
  const t = { tasks, config: fixture.deps.config, audit: fixture.deps.audit, now: fixture.deps.now };
  const { task } = await enqueueHamzaTask(t, enqueueInput);
  await tasks.update(task.id, null, { capUsd: 0.03 });
  const claimed = await tasks.claimNext("w", fixture.deps.now(), 60_000);
  await runHamzaTask(runnerFor(fixture, tasks, Array.from({ length: 5 }, () => ({ action: "tool", tool: "list_tree", args: {} }))), claimed);
  const paused = await tasks.get(task.id);
  assert.equal(paused.status, "budget_paused");
  assert.equal(paused.pauseReason, "task_budget");
  assert.equal(paused.checkpoint.steps, 2);
  assert.match(fixture.repo.messages.at(-1).text, /متابعة حتى \$5\.00/);
  await cancelHamzaTask(t, task.id, actor);

  const { task: broken } = await enqueueHamzaTask(t, enqueueInput);
  const claimed2 = await tasks.claimNext("w", fixture.deps.now(), 60_000);
  await runHamzaTask({ ...runnerFor(fixture, tasks, []), openSnapshot: async () => { throw new Error("tarball 404"); } }, claimed2);
  assert.equal((await tasks.get(broken.id)).status, "failed");
  assert.match(fixture.repo.messages.at(-1).text, /tarball 404/);
});

test("worker tick: kill switches, runs one task, polls CI for PRs waiting on hamza-ci (rate-limited)", async () => {
  const fixture = makeDeps();
  const tasks = memoryTaskRepo();
  const polled = [];
  const worker = (cfg) => ({ config: cfg, tasks, teamRepo: fixture.repo, now: fixture.deps.now, runner: () => runnerFor(fixture, tasks, [{ action: "reply", replyAr: "تمام: الصفحة موجودة في src/app." }]), refreshCi: async (id) => (polled.push(id), { ok: true }) });
  await enqueueHamzaTask({ tasks, config, audit: fixture.deps.audit, now: fixture.deps.now }, enqueueInput);
  assert.deepEqual(await hamzaWorkerTick(worker(hamzaConfig({ HAMZA_WORKER: "0" }))), { polled: 0, errors: [] });
  const tick = await hamzaWorkerTick(worker(config));
  assert.ok(tick.ran);
  assert.equal((await tasks.get(tick.ran)).status, "done");
  assert.match(fixture.repo.messages.at(-1).text, /الصفحة موجودة/);
  const old = new Date(fixture.deps.now().getTime() - 120_000).toISOString();
  const fresh = fixture.deps.now().toISOString();
  await fixture.repo.saveProposal({ id: "p-old", status: "ci_running", updatedAt: fresh, hamza: { prNumber: 1, ci: { checkedAt: old } } });
  await fixture.repo.saveProposal({ id: "p-fresh", status: "ci_running", updatedAt: fresh, hamza: { prNumber: 2, ci: { checkedAt: fresh } } });
  await fixture.repo.saveProposal({ id: "p-pending", status: "pending", updatedAt: fresh, hamza: {} });
  const second = await hamzaWorkerTick(worker(config));
  assert.equal(second.ran, undefined);
  assert.deepEqual(polled, ["p-old"]);
});

test("repair loop: CI failure queues a repair task on the same proposal, at most 2 rounds", async () => {
  const { queueRepair } = await import("../src/lib/hamza/repair.ts");
  const t = taskDeps();
  const proposal = { id: "p1", channel: "developer", commitMessage: "feat: x", hamza: { repairRounds: 0, revision: 1, prNumber: 4 } };
  assert.match(await queueRepair(t.deps, proposal), /1\/2/);
  const queued = t.deps.tasks.store.tasks[0];
  assert.deepEqual([queued.kind, queued.proposalId], ["repair", "p1"]);
  assert.ok(t.audits.some((a) => a.action === "hamza.repair.requested"));
  assert.match(await queueRepair(t.deps, proposal), /لم أبدأ/, "one active task per channel");
  assert.match(await queueRepair(taskDeps().deps, { ...proposal, hamza: { repairRounds: 2 } }), /الحد \(2\)/);
});
