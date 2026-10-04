// In-memory GitHub for Hamza pipeline tests: branches, commits (full trees), PRs, check runs, job logs.
// Blob shas are real git blob shas so the conflict guard behaves exactly as with the API.
import { createHash } from "node:crypto";

export function gitBlobSha(content) {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export function createFakeGithub(initialFiles = {}, base = "agent-hub-latest") {
  let counter = 0;
  const commits = new Map();
  const branches = new Map();
  const prs = new Map();
  const checks = new Map();
  const logs = new Map();
  const calls = [];
  const nextSha = () => createHash("sha1").update(`c${(counter += 1)}`).digest("hex");
  const root = nextSha();
  commits.set(root, { tree: new Map(Object.entries(initialFiles)), parent: null, message: "root" });
  branches.set(base, root);

  const gh = {
    repoLabel: "test/repo",
    calls,
    branches,
    commits,
    prs,
    setChecks(sha, runs) {
      checks.set(sha, runs);
    },
    setLog(jobId, text) {
      logs.set(jobId, text);
    },
    /** Simulates a human push to the base branch. */
    pushToBase(path, content) {
      const parent = branches.get(base);
      const tree = new Map(commits.get(parent).tree);
      if (content === null) tree.delete(path);
      else tree.set(path, content);
      const sha = nextSha();
      commits.set(sha, { tree, parent, message: "human push" });
      branches.set(base, sha);
      return sha;
    },
    treeOf(ref) {
      const sha = branches.get(ref) ?? ref;
      return commits.get(sha)?.tree ?? new Map();
    },
    async getBranchSha(branch) {
      return branches.get(branch) ?? null;
    },
    async readFile(path, ref) {
      const tree = gh.treeOf(ref);
      if (!tree.has(path)) return null;
      const content = tree.get(path);
      return { path, sha: gitBlobSha(content), content, size: Buffer.byteLength(content) };
    },
    async listCommits({ ref, n }) {
      const out = [];
      let sha = branches.get(ref) ?? ref;
      while (sha && out.length < n) {
        const commit = commits.get(sha);
        out.push({ sha, message: commit.message, author: "test", date: "2026-10-04T20:00:00Z", url: `https://example.invalid/${sha}` });
        sha = commit.parent;
      }
      return out;
    },
    async listOpenPrs() {
      return [...prs.values()].filter((pr) => pr.state === "open");
    },
    async getPr(number) {
      const pr = prs.get(number);
      return pr ? { ...pr, headSha: branches.get(pr.headRef) ?? pr.headSha } : null;
    },
    async listCheckRuns(sha) {
      return checks.get(sha) ?? [];
    },
    async getJobLog(jobId) {
      return logs.get(jobId) ?? "";
    },
    async createBranch(branch, sha) {
      calls.push(["createBranch", branch, sha]);
      if (branches.has(branch)) throw new Error("exists");
      branches.set(branch, sha);
    },
    async commitTree({ branch, parentSha, message, files }) {
      calls.push(["commitTree", branch, files.map((f) => `${f.content === null ? "D" : "W"} ${f.path}`)]);
      if (branches.get(branch) !== parentSha) throw new Error("not a fast-forward");
      const tree = new Map(commits.get(parentSha).tree);
      for (const file of files) {
        if (file.content === null) tree.delete(file.path);
        else tree.set(file.path, file.content);
      }
      const sha = nextSha();
      commits.set(sha, { tree, parent: parentSha, message });
      branches.set(branch, sha);
      return { sha, url: `https://example.invalid/commit/${sha}` };
    },
    async findOpenPrByHead(head) {
      return [...prs.values()].find((pr) => pr.headRef === head && pr.state === "open") ?? null;
    },
    async openPr({ head, base: target, title, body }) {
      calls.push(["openPr", head, target]);
      const number = prs.size + 1;
      const pr = { number, url: `https://example.invalid/pull/${number}`, title, body, headRef: head, headSha: branches.get(head), baseRef: target, state: "open", merged: false, draft: false };
      prs.set(number, pr);
      return { ...pr };
    },
    async mergePr({ prNumber, sha, title }) {
      calls.push(["mergePr", prNumber, sha]);
      const pr = prs.get(prNumber);
      if (branches.get(pr.headRef) !== sha) throw new Error("Head branch was modified");
      const tree = new Map(commits.get(sha).tree);
      const merged = nextSha();
      commits.set(merged, { tree, parent: branches.get(pr.baseRef), message: title });
      branches.set(pr.baseRef, merged);
      pr.state = "closed";
      pr.merged = true;
      return { sha: merged };
    },
    async closePr(number) {
      calls.push(["closePr", number]);
      prs.get(number).state = "closed";
    },
  };
  return gh;
}
