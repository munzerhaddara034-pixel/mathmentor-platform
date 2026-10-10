import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setPersistentStoreOverride } from "../src/lib/dataDir.ts";
import {
  createDraftPullRequest,
  draftPullRequest,
  isValidAgentDraftBranch,
  resetPrDraftTestState,
  setPrDraftTestOverrides,
} from "../src/lib/team/prDrafts.ts";

const docs = new Map();
setPersistentStoreOverride({
  async getJSON(key) { return docs.has(key) ? structuredClone(docs.get(key)) : null; },
  async setJSON(key, value) { docs.set(key, structuredClone(value)); },
});
const originalEnv = Object.fromEntries(["AGENT_PR_DRAFTS", "AGENT_PR_DRAFTS_MAX_PER_DAY", "GITHUB_AGENT_TOKEN", "GITHUB_AGENT_REPO"].map((key) => [key, process.env[key]]));
const noopEscalate = async () => ({ itemId: "security-test-escalation", whatsapp: "notified" });

function clear() {
  docs.clear();
  resetPrDraftTestState();
  for (const key of Object.keys(originalEnv)) delete process.env[key];
}
function patchFor(path = "src/example.ts", added = ["const b = 2;"]) {
  return [`diff --git a/${path} b/${path}`, "index aa..bb 100644", `--- a/${path}`, `+++ b/${path}`, `@@ -1 +1,${1 + added.length} @@`, " const a = 1;", ...added.map((line) => `+${line}`), ""].join("\n");
}
function args(patch = patchFor(), files = ["src/example.ts"], extra = {}) {
  return { agentId: "developer", title: "Add Example Feature", summary: "A reviewed draft", rationale: "The requested behavior needs a small implementation.", patch, files, ...extra };
}
function stored() { return docs.get("team-agent-health.json") ?? {}; }
function githubStub({ prNumber = 17, prUrl = "https://github.com/owner/repository/pull/17", status = 200 } = {}) {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    const u = String(url);
    if (status !== 200) return Response.json({ message: "rate limited" }, { status });
    if (u.endsWith("/git/ref/heads/agent-hub-latest")) return Response.json({ object: { sha: "base-sha" } });
    if (u.endsWith("/git/commits/base-sha")) return Response.json({ tree: { sha: "base-tree-sha" } });
    if (u.includes("/contents/src/example.ts")) return Response.json({ content: Buffer.from("const a = 1;\n").toString("base64"), encoding: "base64" });
    if (u.endsWith("/git/blobs")) return Response.json({ sha: "blob-sha" });
    if (u.endsWith("/git/refs")) return Response.json({ ref: "refs/heads/agent/developer-add-example-feature" });
    if (u.endsWith("/git/trees")) return Response.json({ sha: "tree-sha" });
    if (u.endsWith("/git/commits")) return Response.json({ sha: "commit-sha" });
    if (u.includes("/git/refs/heads/agent/")) return Response.json({ ref: "updated" });
    if (u.endsWith("/pulls")) return Response.json({ html_url: prUrl, number: prNumber });
    throw new Error(`unexpected stub URL ${u}`);
  };
  return { fetchImpl, requests };
}

after(() => {
  clear();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  setPersistentStoreOverride(null);
});

test("path trickery is rejected with a localized forbidden-path reason", async () => {
  clear();
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const cases = [
    "../src/example.ts",
    "/etc/passwd",
    "src//lib/auth/x.ts",
    "src\\lib\\auth\\x.ts",
    "src/%2e%2e/%2eenv",
    "src/\uFF0Flib/auth/x.ts",
    "docs/guide\u00a0.md",
    "docs/../.github/workflows/ci.yml",
    "src/lib/security/../auth/x.ts",
  ];
  for (const path of cases) {
    const result = await draftPullRequest(args(patchFor(path), [path]));
    assert.equal(result.ok, false, path);
    assert.match(result.reasonAr, /محظور|النطاق|Diff|تغيير/);
  }
});

test("denylist naming bypasses are rejected case-insensitively and after resolution", async () => {
  clear();
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const paths = [
    ".ENV",
    "src/lib/Auth/guard.ts",
    "./src/lib/auth/guard.ts",
    "src//lib/auth/guard.ts",
    "src/lib/security/../auth/x.ts",
    ".env.local",
    ".env.production",
    "package-lock.json",
    "pnpm-lock.yaml",
    ".github/workflows/x.yml",
    "docs/../.github/workflows/x.yml",
  ];
  for (const path of paths) {
    const result = await draftPullRequest(args(patchFor(path), [path]));
    assert.equal(result.ok, false, path);
    assert.match(result.reasonAr, /محظور|النطاق/);
  }
});

test("the authoritative file set comes from the diff, not a client declaration", async () => {
  clear();
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const patch = patchFor("src/example.ts");
  for (const files of [["src/other.ts"], [], ["src/example.ts", "docs/extra.md"], ["src/example.ts", "src/example.ts"]]) {
    const result = await draftPullRequest(args(patch, files));
    assert.equal(result.ok, false);
    assert.match(result.reasonAr, /unified diff|قائمة الملفات|Diff/);
  }
  const accepted = await draftPullRequest(args(patch, ["src/example.ts"], { declaredSize: 1 }));
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.draft.files, ["src/example.ts"]);
});

test("header spoofing and dangerous diff metadata are rejected", async () => {
  clear();
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const secondDenied = `${patchFor("src/example.ts")}${patchFor("src/lib/auth/guard.ts")}`;
  const spoofedHeaders = patchFor("src/example.ts").replace("+++ b/src/example.ts", "+++ b/src/lib/auth/guard.ts");
  const cases = [
    [secondDenied, ["src/example.ts", "src/lib/auth/guard.ts"]],
    [spoofedHeaders, ["src/example.ts"]],
    [patchFor("src/example.ts").replace("index aa..bb 100644", "index aa..bb 100644\nnew file mode 100644"), ["src/example.ts"]],
    [patchFor("src/example.ts").replace("index aa..bb 100644", "index aa..bb 100644\ndeleted file mode 100644"), ["src/example.ts"]],
    [patchFor("src/example.ts").replace("index aa..bb 100644", "index aa..bb 100644\nrename from src/example.ts\nrename to src/other.ts"), ["src/example.ts"]],
    [patchFor("src/example.ts").replace("index aa..bb 100644", "index aa..bb 100644\ncopy from src/example.ts\ncopy to src/other.ts"), ["src/example.ts"]],
    [patchFor("src/example.ts").replace("index aa..bb 100644", "index aa..bb 100644\nnew file mode 120000"), ["src/example.ts"]],
    [patchFor("src/example.ts").replace("index aa..bb 100644", "index aa..bb 100644\nGIT binary patch\nliteral 12"), ["src/example.ts"]],
    [patchFor("src/example.ts").replace("index aa..bb 100644", "index aa..bb 100644\nBinary files a/src/example.ts and b/src/example.ts differ"), ["src/example.ts"]],
    [patchFor("src/example.ts").replace("--- a/src/example.ts", "--- /dev/null"), ["src/example.ts"]],
  ];
  for (const [patch, files] of cases) {
    const result = await draftPullRequest(args(patch, files));
    assert.equal(result.ok, false, String(patch).slice(0, 60));
    assert.match(result.reasonAr, /unified diff|قائمة الملفات|Diff|محظور|النطاق/);
  }
});

test("file, changed-line, byte, message, and real-size caps cannot be evaded", async () => {
  clear();
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const paths = Array.from({ length: 13 }, (_, index) => `docs/file-${index}.md`);
  const thirteen = paths.map((path) => patchFor(path)).join("");
  assert.match((await draftPullRequest(args(thirteen, paths))).reasonAr, /12/);
  const fourOhOne = patchFor("docs/large.md", Array.from({ length: 401 }, (_, index) => `line-${index}`));
  assert.match((await draftPullRequest(args(fourOhOne, ["docs/large.md"]))).reasonAr, /400/);
  assert.match((await draftPullRequest(args("x".repeat(200 * 1024 + 1), ["src/example.ts"]))).reasonAr, /200/);
  assert.match((await draftPullRequest(args(patchFor(), ["src/example.ts"], { commitMessage: "x".repeat(201) }))).reasonAr, /200/);
  const sized = await draftPullRequest(args(patchFor(), ["src/example.ts"], { patchBytes: 1 }));
  assert.equal(sized.ok, true, "undeclared client size cannot make the real patch smaller or larger");
  assert.equal(Buffer.byteLength(stored().prDrafts.at(-1).patch), Buffer.byteLength(patchFor()));
});

test("branch names strictly reject injection, traversal, empty slugs, unicode slugs, and protected refs", () => {
  const rejected = [
    "agent/developer-x;rm-rf",
    "agent/developer-x\n",
    "agent/developer-..",
    "agent/developer-",
    "agent/developer-你好",
    "agent/x; rm -rf",
    "agent-hub-latest",
    "main",
    "master",
    "refs/heads/arbitrary",
  ];
  for (const branch of rejected) assert.equal(isValidAgentDraftBranch("developer", branch), false, branch);
  assert.equal(isValidAgentDraftBranch("developer", "agent/developer-safe-change"), true);
});

test("the create action uses only the stored draft and fixed server configuration", async () => {
  clear();
  process.env.GITHUB_AGENT_TOKEN = "server-token-never-returned";
  process.env.GITHUB_AGENT_REPO = "owner/repository";
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const made = await draftPullRequest(args(patchFor(), ["src/example.ts"], { branch: "main", repo: "attacker/evil", base: "main", title: "Stored Title" }));
  assert.equal(made.ok, true);
  const stub = githubStub();
  setPrDraftTestOverrides({ escalate: noopEscalate, fetchImpl: stub.fetchImpl });
  const result = await createDraftPullRequest(made.draft.id, { patch: patchFor("src/lib/auth/guard.ts"), repo: "attacker/evil", base: "main" });
  assert.equal(result.ok, true);
  assert.ok(stub.requests.every(({ url }) => url.startsWith("https://api.github.com/repos/owner/repository/")));
  const prBody = JSON.parse(stub.requests.find(({ url }) => url.endsWith("/pulls")).init.body);
  assert.equal(prBody.base, "agent-hub-latest");
  assert.equal(prBody.head, made.draft.branch);
  assert.equal(prBody.title.includes("Stored Title"), true);
});

test("staff-only create and listing routes do not accept a client-controlled repository or draft body", () => {
  const createRoute = readFileSync("src/app/api/admin/team/pr-drafts/[id]/route.ts", "utf8");
  const listRoute = readFileSync("src/app/api/admin/team/pr-drafts/route.ts", "utf8");
  assert.match(createRoute, /requireTeamStaff\(\)/);
  assert.match(listRoute, /requireTeamStaff\(\)/);
  assert.doesNotMatch(createRoute, /request\.json\(\)|GITHUB_AGENT_REPO|base\s*:/);
  assert.doesNotMatch(listRoute, /request\.json\(\)|repo|base/);
});

test("replaying a stored draft is idempotent and does not open a second PR", async () => {
  clear();
  process.env.GITHUB_AGENT_TOKEN = "server-token-idempotency";
  process.env.GITHUB_AGENT_REPO = "owner/repository";
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const made = await draftPullRequest(args());
  assert.equal(made.ok, true);
  const stub = githubStub();
  setPrDraftTestOverrides({ escalate: noopEscalate, fetchImpl: stub.fetchImpl });
  const first = await createDraftPullRequest(made.draft.id);
  const callCount = stub.requests.length;
  const second = await createDraftPullRequest(made.draft.id);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.draft.prNumber, first.draft.prNumber);
  assert.equal(stub.requests.length, callCount);
  assert.equal(stored().prDrafts.at(-1).status, "pr_open");
});

test("missing GitHub configuration returns the localized غير مهيّأ error and does not mutate storage", async () => {
  clear();
  const before = JSON.stringify(stored());
  const result = await createDraftPullRequest("not-present");
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.match(result.errorAr, /غير مهيّأ/);
  assert.equal(JSON.stringify(stored()), before);
});

test("server token never reaches response, store, audit, log, or PR body", async () => {
  clear();
  const token = "server-token-secret-hygiene";
  process.env.GITHUB_AGENT_TOKEN = token;
  process.env.GITHUB_AGENT_REPO = "owner/repository";
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const made = await draftPullRequest(args(patchFor(), ["src/example.ts"], { title: `Title ${token}`, summary: `Summary ${token}`, rationale: `Rationale ${token}`, commitMessage: `Commit ${token}` }));
  assert.equal(made.ok, true);
  const stub = githubStub();
  const logs = [];
  const originalLog = console.log, originalError = console.error;
  console.log = (...values) => logs.push(values.join(" "));
  console.error = (...values) => logs.push(values.join(" "));
  try {
    setPrDraftTestOverrides({ escalate: noopEscalate, fetchImpl: stub.fetchImpl });
    const result = await createDraftPullRequest(made.draft.id);
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(result).includes(token), false);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(JSON.stringify(stored()).includes(token), false);
  assert.equal(JSON.stringify(logs).includes(token), false);
  const prBody = JSON.parse(stub.requests.find(({ url }) => url.endsWith("/pulls")).init.body);
  assert.equal(JSON.stringify(prBody).includes(token), false);
  assert.equal(JSON.stringify(stored().prDraftAudits).includes(token), false);
});

test("kill switch performs no network call and the five-per-day budget is enforced", async () => {
  clear();
  process.env.AGENT_PR_DRAFTS = "off";
  let calls = 0;
  setPrDraftTestOverrides({ fetchImpl: async () => { calls += 1; throw new Error("network must not run"); }, escalate: noopEscalate });
  const disabled = await draftPullRequest(args());
  assert.equal(disabled.ok, false);
  assert.match(disabled.reasonAr, /متوقف/);
  assert.equal(calls, 0);
  assert.equal(docs.size, 0);

  clear();
  process.env.AGENT_PR_DRAFTS_MAX_PER_DAY = "100";
  setPrDraftTestOverrides({ escalate: noopEscalate });
  for (let index = 0; index < 5; index += 1) {
    const result = await draftPullRequest(args(patchFor(`docs/budget-${index}.md`), [`docs/budget-${index}.md`], { title: `Budget Draft ${index}` }));
    assert.equal(result.ok, true, String(result.reasonAr));
  }
  const sixth = await draftPullRequest(args(patchFor("docs/budget-six.md"), ["docs/budget-six.md"], { title: "Budget Draft Six" }));
  assert.equal(sixth.ok, false);
  assert.match(sixth.reasonAr, /الحد اليومي/);
});

test("GitHub rate-limit responses are recorded as failed without leaking the token", async () => {
  clear();
  process.env.GITHUB_AGENT_TOKEN = "server-token-rate-limit";
  process.env.GITHUB_AGENT_REPO = "owner/repository";
  setPrDraftTestOverrides({ escalate: noopEscalate });
  const made = await draftPullRequest(args());
  assert.equal(made.ok, true);
  const stub = githubStub({ status: 429 });
  setPrDraftTestOverrides({ escalate: noopEscalate, fetchImpl: stub.fetchImpl });
  const result = await createDraftPullRequest(made.draft.id);
  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.equal(stored().prDrafts.at(-1).status, "failed");
  assert.equal(JSON.stringify(stored()).includes(process.env.GITHUB_AGENT_TOKEN), false);
  assert.equal(stored().prDraftAudits.at(-1).status, "failed");
});
