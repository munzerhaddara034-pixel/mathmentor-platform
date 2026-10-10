import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setPersistentStoreOverride } from "../src/lib/dataDir.ts";
import { verifyReply } from "../src/lib/team/agentLoop.ts";
import { createDraftPullRequest, draftPullRequest, isValidAgentDraftBranch, listPrDrafts, resetPrDraftTestState, setPrDraftTestOverrides } from "../src/lib/team/prDrafts.ts";

const docs = new Map();
setPersistentStoreOverride({ async getJSON(key) { return docs.has(key) ? structuredClone(docs.get(key)) : null; }, async setJSON(key, value) { docs.set(key, structuredClone(value)); } });
const env = { kill: process.env.AGENT_PR_DRAFTS, cap: process.env.AGENT_PR_DRAFTS_MAX_PER_DAY, token: process.env.GITHUB_AGENT_TOKEN, repo: process.env.GITHUB_AGENT_REPO };
function clear() { docs.clear(); resetPrDraftTestState(); delete process.env.AGENT_PR_DRAFTS; delete process.env.AGENT_PR_DRAFTS_MAX_PER_DAY; delete process.env.GITHUB_AGENT_TOKEN; delete process.env.GITHUB_AGENT_REPO; }
const noopEscalate = async () => ({ itemId: "test-escalation", whatsapp: "notified" });
function patchFor(path = "src/example.ts", added = ["const b = 2;"]) { return [`diff --git a/${path} b/${path}`, "index aa..bb 100644", `--- a/${path}`, `+++ b/${path}`, `@@ -1 +1,${1 + added.length} @@`, " const a = 1;", ...added.map((x) => `+${x}`), ""].join("\n"); }
function args(patch = patchFor(), files = ["src/example.ts"]) { return { agentId: "developer", title: "Add Example Feature", summary: "A reviewed draft", rationale: "The requested behavior needs a small implementation.", patch, files }; }
after(() => { clear(); for (const [name, value] of Object.entries(env)) { const target = { kill: "AGENT_PR_DRAFTS", cap: "AGENT_PR_DRAFTS_MAX_PER_DAY", token: "GITHUB_AGENT_TOKEN", repo: "GITHUB_AGENT_REPO" }[name]; if (value === undefined) delete process.env[target]; else process.env[target] = value; } setPersistentStoreOverride(null); });
function githubStub({ prStatus = 201, prBody = { html_url: "https://github.com/owner/repository/pull/17", number: 17 }, branchStatus = 201, prError } = {}) {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), init }); const u = String(url);
    if (u.endsWith("/git/ref/heads/agent-hub-latest")) return Response.json({ object: { sha: "base-sha" } });
    if (u.endsWith("/git/commits/base-sha")) return Response.json({ tree: { sha: "base-tree-sha" } });
    if (u.includes("/contents/src/example.ts")) return Response.json({ content: Buffer.from("const a = 1;\n").toString("base64"), encoding: "base64" });
    if (u.endsWith("/git/blobs")) return Response.json({ sha: "blob-sha" });
    if (u.endsWith("/git/refs")) return Response.json({ ref: "refs/heads/agent/developer-add-example-feature" }, { status: branchStatus });
    if (u.endsWith("/git/trees")) return Response.json({ sha: "tree-sha" });
    if (u.endsWith("/git/commits")) return Response.json({ sha: "commit-sha" });
    if (u.includes("/git/refs/heads/agent/")) return Response.json({ ref: "updated" });
    if (u.endsWith("/pulls")) { if (prError) throw prError; return Response.json(prBody, { status: prStatus }); }
    throw Error(`unexpected stub URL ${u}`);
  };
  return { fetchImpl, requests };
}

test("forbidden paths are rejected: auth, env, workflows, package manifests, middleware and db/security", async () => {
  clear(); setPrDraftTestOverrides({ escalate: noopEscalate });
  for (const path of ["src/lib/auth/guard.ts", ".env.example", ".github/workflows/ci.yml", "package.json", "src/middleware.ts", "src/lib/db/query.ts", "src/lib/security/fetch.ts", "data/users.json", "migrations/001.sql"]) {
    const result = await draftPullRequest(args(patchFor(path), [path])); assert.equal(result.ok, false, path); assert.match(result.reasonAr, /محظور|النطاق/);
  }
});

test("file count, changed-line count and patch-byte limits reject oversize drafts", async () => {
  clear();
  const paths = Array.from({ length: 13 }, (_, i) => `docs/file-${i}.md`);
  const manyFiles = paths.map((p) => patchFor(p, ["new"])).join("");
  assert.match((await draftPullRequest(args(manyFiles, paths)).then((x) => x.reasonAr)), /12/);
  const manyLines = patchFor("docs/large.md", Array.from({ length: 401 }, (_, i) => `line-${i}`));
  assert.match((await draftPullRequest(args(manyLines, ["docs/large.md"])).then((x) => x.reasonAr)), /400/);
  assert.match((await draftPullRequest(args("x".repeat(200 * 1024 + 1), ["src/example.ts"])).then((x) => x.reasonAr)), /200/);
});

test("valid patch is stored as bounded draft and branch follows agent/<agent>-<slug>", async () => {
  clear(); setPrDraftTestOverrides({ escalate: noopEscalate });
  const result = await draftPullRequest(args()); assert.equal(result.ok, true);
  assert.equal(result.draft.branch, "agent/developer-add-example-feature"); assert.equal(result.draft.status, "draft"); assert.equal(result.draft.files[0], "src/example.ts");
  const record = (await listPrDrafts())[0]; assert.equal(record.id, result.draft.id); assert.equal(record.patch, undefined); assert.equal(record.verdict.startsWith("PASS"), true);
  const stored = docs.get("team-agent-health.json"); assert.equal(stored.prDrafts.length, 1); assert.equal(stored.prDrafts[0].patch, patchFor());
});

test("protected branch names are never targets (including deploy, main and master)", async () => {
  clear();
  const result = await draftPullRequest(args()); assert.equal(result.ok, true);
  assert.equal(isValidAgentDraftBranch("developer", result.draft.branch), true);
  for (const branch of ["agent-hub-latest", "main", "master"]) assert.equal(isValidAgentDraftBranch("developer", branch), false);
});

test("per-agent daily cap rejects the next draft", async () => {
  clear(); process.env.AGENT_PR_DRAFTS_MAX_PER_DAY = "1"; setPrDraftTestOverrides({ escalate: noopEscalate });
  assert.equal((await draftPullRequest(args())).ok, true);
  const next = await draftPullRequest({ ...args(), title: "Second Draft" }); assert.equal(next.ok, false); assert.match(next.reasonAr, /الحد اليومي/);
});

test("kill switch returns localized notice before any network call", async () => {
  clear(); process.env.AGENT_PR_DRAFTS = "off"; let calls = 0;
  setPrDraftTestOverrides({ fetchImpl: async () => { calls++; throw Error("network must not run"); }, escalate: noopEscalate });
  const result = await draftPullRequest(args()); assert.equal(result.ok, false); assert.match(result.reasonAr, /متوقف/); assert.equal(calls, 0); assert.equal(docs.size, 0);
});

test("staff PR action creates branch/commit/PR and audits URL, number and pending CI without leaking token", async () => {
  clear(); process.env.GITHUB_AGENT_TOKEN = "test-secret-token-never-store"; process.env.GITHUB_AGENT_REPO = "owner/repository"; setPrDraftTestOverrides({ escalate: noopEscalate });
  const made = await draftPullRequest(args()); assert.equal(made.ok, true);
  const requests = [];
  setPrDraftTestOverrides({ escalate: noopEscalate, fetchImpl: async (url, init = {}) => {
    requests.push({ url: String(url), init }); const u = String(url);
    if (u.endsWith("/git/ref/heads/agent-hub-latest")) return Response.json({ object: { sha: "base-sha" } });
    if (u.endsWith("/git/commits/base-sha")) return Response.json({ tree: { sha: "base-tree-sha" } });
    if (u.includes("/contents/src/example.ts")) return Response.json({ content: Buffer.from("const a = 1;\n").toString("base64"), encoding: "base64" });
    if (u.endsWith("/git/blobs")) return Response.json({ sha: "blob-sha" });
    if (u.endsWith("/git/refs")) return Response.json({ ref: "refs/heads/agent/developer-add-example-feature" });
    if (u.endsWith("/git/trees")) return Response.json({ sha: "tree-sha" });
    if (u.endsWith("/git/commits")) return Response.json({ sha: "commit-sha" });
    if (u.includes("/git/refs/heads/agent/")) return Response.json({ ref: "updated" });
    if (u.endsWith("/pulls")) return Response.json({ html_url: "https://github.com/owner/repository/pull/17", number: 17 });
    throw Error(`unexpected stub URL ${u}`);
  } });
  const result = await createDraftPullRequest(made.draft.id); assert.equal(result.ok, true, `${result.errorAr} :: ${docs.get("team-agent-health.json").prDrafts.at(-1).error}`); assert.equal(result.draft.status, "pr_open"); assert.equal(result.draft.prUrl, "https://github.com/owner/repository/pull/17"); assert.equal(result.draft.prNumber, 17); assert.equal(result.draft.ci, "pending");
  const audit = docs.get("team-agent-health.json").prDraftAudits.at(-1); assert.equal(audit.prUrl, "https://github.com/owner/repository/pull/17"); assert.equal(audit.prNumber, 17); assert.equal(audit.ci, "pending");
  assert.equal(requests.some((r) => r.url.endsWith("/git/refs")), true); assert.equal(requests.some((r) => r.url.endsWith("/pulls")), true);
  const allStored = JSON.stringify(docs.get("team-agent-health.json")); assert.equal(allStored.includes(process.env.GITHUB_AGENT_TOKEN), false);
  assert.equal(JSON.stringify(result).includes(process.env.GITHUB_AGENT_TOKEN), false); assert.equal(JSON.stringify(made).includes(process.env.GITHUB_AGENT_TOKEN), false); assert.equal(requests.every((r) => r.init.headers.authorization === `Bearer ${process.env.GITHUB_AGENT_TOKEN}`), true);
});

test("PR permission denial preserves the pushed branch and returns a one-click compare link without leaking token", async () => {
  clear(); process.env.GITHUB_AGENT_TOKEN = "permission-denial-test-secret"; process.env.GITHUB_AGENT_REPO = "owner/repository";
  const made = await draftPullRequest(args()); assert.equal(made.ok, true);
  const stub = githubStub({ prStatus: 403, prBody: { message: "Resource not accessible by integration" } });
  setPrDraftTestOverrides({ fetchImpl: stub.fetchImpl, escalate: noopEscalate });
  const result = await createDraftPullRequest(made.draft.id);
  const stored = docs.get("team-agent-health.json").prDrafts.at(-1);
  assert.equal(result.ok, true); assert.equal(result.draft.status, "branch_pushed");
  assert.equal(result.compareUrl, "https://github.com/owner/repository/compare/agent-hub-latest...agent/developer-add-example-feature?expand=1");
  assert.equal(result.draft.compareUrl, result.compareUrl); assert.match(result.notice, /Pull requests: Read and write/);
  assert.equal(stored.status, "branch_pushed"); assert.equal(stored.branch, "agent/developer-add-example-feature");
  assert.equal(stored.error, undefined); assert.equal(stored.prUrl, undefined); assert.equal(stored.compareUrl, result.compareUrl);
  assert.equal(docs.get("team-agent-health.json").prDraftAudits.at(-1).status, "branch_pushed");
  assert.equal(docs.get("team-agent-health.json").prDrafts.some((draft) => draft.id === made.draft.id && draft.status === "failed"), false);
  assert.equal(JSON.stringify(docs).includes(process.env.GITHUB_AGENT_TOKEN), false);
  assert.equal(JSON.stringify(result).includes(process.env.GITHUB_AGENT_TOKEN), false);
  assert.equal(stub.requests.some((request) => request.url.endsWith("/git/refs")), true);
  assert.equal(stub.requests.some((request) => request.url.endsWith("/git/trees")), true);
  assert.equal(stub.requests.some((request) => request.url.endsWith("/git/commits")), true);
  assert.equal(stub.requests.some((request) => request.url.includes("/git/refs/heads/agent/")), true);
  assert.equal(stub.requests.some((request) => request.url.endsWith("/pulls")), true);
});

test('plain "GitHub API failed (403)." after a successful push preserves the branch and compare URL without leaking token', async () => {
  clear(); process.env.GITHUB_AGENT_TOKEN = "plain-403-test-secret"; process.env.GITHUB_AGENT_REPO = "owner/repository";
  const made = await draftPullRequest(args()); assert.equal(made.ok, true);
  const stub = githubStub({ prError: new Error("GitHub API failed (403).") });
  setPrDraftTestOverrides({ fetchImpl: stub.fetchImpl, escalate: noopEscalate });
  const result = await createDraftPullRequest(made.draft.id);
  const stored = docs.get("team-agent-health.json").prDrafts.at(-1);
  assert.equal(result.ok, true); assert.equal(result.draft.status, "branch_pushed");
  assert.equal(result.compareUrl, "https://github.com/owner/repository/compare/agent-hub-latest...agent/developer-add-example-feature?expand=1");
  assert.equal(stored.status, "branch_pushed"); assert.equal(stored.compareUrl, result.compareUrl); assert.equal(stored.prUrl, undefined); assert.equal(stored.prNumber, undefined);
  assert.match(result.notice, /Pull requests: Read and write/);
  assert.equal(docs.get("team-agent-health.json").prDraftAudits.at(-1).status, "branch_pushed");
  assert.equal(stub.requests.some((request) => request.url.includes("/git/refs/heads/agent/")), true);
  assert.equal(stub.requests.some((request) => request.url.endsWith("/pulls")), true);
  assert.equal(JSON.stringify(docs).includes(process.env.GITHUB_AGENT_TOKEN), false);
  assert.equal(JSON.stringify(result).includes(process.env.GITHUB_AGENT_TOKEN), false);
});

test("post-push 404 is a genuine failure, not a permission denial, and never leaks token", async () => {
  clear(); process.env.GITHUB_AGENT_TOKEN = "post-push-404-test-secret"; process.env.GITHUB_AGENT_REPO = "owner/repository";
  const made = await draftPullRequest(args()); assert.equal(made.ok, true);
  const stub = githubStub({ prStatus: 404, prBody: { message: "Not Found" } });
  setPrDraftTestOverrides({ fetchImpl: stub.fetchImpl, escalate: noopEscalate });
  const result = await createDraftPullRequest(made.draft.id);
  const stored = docs.get("team-agent-health.json").prDrafts.at(-1);
  assert.equal(result.ok, false); assert.equal(stored.status, "failed"); assert.match(stored.error, /GitHub API failed \(404\)/);
  assert.equal(stored.compareUrl, undefined); assert.equal(stored.prUrl, undefined); assert.equal(docs.get("team-agent-health.json").prDraftAudits.at(-1).status, "failed");
  assert.equal(JSON.stringify(docs).includes(process.env.GITHUB_AGENT_TOKEN), false);
  assert.equal(JSON.stringify(result).includes(process.env.GITHUB_AGENT_TOKEN), false);
});

test("genuine branch-creation failure remains failed with an error", async () => {
  clear(); process.env.GITHUB_AGENT_TOKEN = "branch-failure-test-secret"; process.env.GITHUB_AGENT_REPO = "owner/repository";
  const made = await draftPullRequest(args()); assert.equal(made.ok, true);
  const stub = githubStub({ branchStatus: 422 });
  setPrDraftTestOverrides({ fetchImpl: stub.fetchImpl, escalate: noopEscalate });
  const result = await createDraftPullRequest(made.draft.id);
  const stored = docs.get("team-agent-health.json").prDrafts.at(-1);
  assert.equal(result.ok, false); assert.equal(stored.status, "failed"); assert.match(stored.error, /GitHub API failed \(422\)/);
  assert.equal(stored.compareUrl, undefined); assert.equal(stub.requests.some((request) => request.url.endsWith("/pulls")), false);
  assert.equal(JSON.stringify(docs).includes(process.env.GITHUB_AGENT_TOKEN), false);
  assert.equal(JSON.stringify(result).includes(process.env.GITHUB_AGENT_TOKEN), false);
});

test("verification gate requires both a passing guardrail verdict and a stored patch for prepared-change claims", () => {
  const text = "جهزت التعديل المطلوب في مسودّة قابلة للمراجعة من فريق العمل.";
  const absent = verifyReply({ text, intent: "تعديل كود", tools: { names: ["draft_pull_request"], outputs: [] } });
  assert.equal(absent.ok, false); assert.match(absent.couldNotVerify, /patch|حواجز/);
  const passed = verifyReply({ text, intent: "تعديل كود", tools: { names: ["draft_pull_request"], outputs: ["{\"patchPresent\":true}"], prDraftPrepared: true, prDraftVerdict: "PASS" } });
  assert.equal(passed.ok, true);
});

test("missing GitHub configuration returns localized not-configured error without changing store", async () => {
  clear(); const before = JSON.stringify(docs.get("team-agent-health.json") ?? null);
  const result = await createDraftPullRequest("not-present"); assert.equal(result.ok, false); assert.equal(result.status, 503); assert.match(result.errorAr, /غير مهيّأ/); assert.equal(JSON.stringify(docs.get("team-agent-health.json") ?? null), before);
});
