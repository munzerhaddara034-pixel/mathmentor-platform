/**
 * Octokit implementation of the Hamza GitHub interface. Writes need GITHUB_TOKEN (use a fine-grained PAT
 * scoped to this one repo: contents + pull_requests write, checks + actions read; no workflows, no admin).
 * Defence in depth: every write re-checks the agent branch policy here, whatever the caller did.
 */
import { Octokit } from "@octokit/rest";
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";
import { hamzaConfig } from "../config";
import { hamzaReadiness } from "../readiness";
import type { CheckRunInfo, HamzaGithubReader, HamzaGithubWriter, PrInfo } from "./types";

export type GithubRepoRef = { owner: string; repo: string };

function token(): string {
  return process.env.GITHUB_TOKEN?.trim() || "";
}

export function githubTokenPresent(): boolean {
  return Boolean(token());
}

type PullLike = {
  number: number;
  html_url: string;
  title: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  state: string;
  merged_at?: string | null;
  merged?: boolean;
  draft?: boolean;
};

function toPr(pull: PullLike): PrInfo {
  return {
    number: pull.number,
    url: pull.html_url,
    title: pull.title,
    headRef: pull.head.ref,
    headSha: pull.head.sha,
    baseRef: pull.base.ref,
    state: pull.state === "open" ? "open" : "closed",
    merged: Boolean(pull.merged ?? pull.merged_at),
    draft: Boolean(pull.draft),
  };
}

function status(value: string | null | undefined): CheckRunInfo["status"] {
  return value === "completed" || value === "in_progress" ? value : "queued";
}

/** Throws when the branch is not a writable agent branch (feat/ fix/ chore/ docs/, never live/main). */
export function assertAgentWritableBranch(branch: string): void {
  const config = hamzaConfig();
  const check = agentCommitBranchCheck(branch, { liveBranch: config.baseBranch.branch });
  if (!check.ok) throw new Error(check.reason);
  if (config.liveBranches.includes(branch)) throw new Error(`Agents may never write to ${branch} (live branch).`);
}

function reader(kit: Octokit, ref: GithubRepoRef): HamzaGithubReader {
  const { owner, repo } = ref;
  return {
    repoLabel: `${owner}/${repo}`,
    async getBranchSha(branch) {
      try {
        const res = await kit.git.getRef({ owner, repo, ref: `heads/${branch}` });
        return res.data.object.sha;
      } catch {
        return null;
      }
    },
    async readFile(path, at) {
      try {
        const res = await kit.repos.getContent({ owner, repo, path, ref: at });
        if (Array.isArray(res.data) || res.data.type !== "file") return null;
        const content = Buffer.from(res.data.content ?? "", "base64").toString("utf8");
        return { path, sha: res.data.sha, content, size: res.data.size };
      } catch {
        return null;
      }
    },
    async listCommits({ ref: sha, path, n }) {
      const res = await kit.repos.listCommits({ owner, repo, sha, path, per_page: Math.min(20, Math.max(1, n)) });
      return res.data.map((item) => ({
        sha: item.sha,
        message: item.commit.message.split("\n")[0].slice(0, 200),
        author: item.commit.author?.name ?? item.author?.login ?? "",
        date: item.commit.author?.date ?? "",
        url: item.html_url,
      }));
    },
    async listOpenPrs() {
      const res = await kit.pulls.list({ owner, repo, state: "open", per_page: 30 });
      return res.data.map((pull) => toPr(pull));
    },
    async getPr(prNumber) {
      try {
        const res = await kit.pulls.get({ owner, repo, pull_number: prNumber });
        return toPr(res.data);
      } catch {
        return null;
      }
    },
    async listCheckRuns(sha) {
      const res = await kit.checks.listForRef({ owner, repo, ref: sha, per_page: 100 });
      return res.data.check_runs.map((run) => {
        const job = run.details_url?.match(/\/job\/(\d+)/)?.[1];
        return {
          id: run.id,
          name: run.name,
          status: status(run.status),
          conclusion: run.conclusion ?? null,
          url: run.html_url ?? run.details_url ?? undefined,
          startedAt: run.started_at ?? undefined,
          completedAt: run.completed_at ?? undefined,
          jobId: job ? Number(job) : run.id,
        };
      });
    },
    async getJobLog(jobId) {
      try {
        const res = await kit.actions.downloadJobLogsForWorkflowRun({ owner, repo, job_id: jobId });
        const data: unknown = res.data;
        if (typeof data === "string") return data;
        if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
        return "";
      } catch {
        return "";
      }
    },
  };
}

/** Read-only client (anonymous for public repos when no token). */
export function octokitReader(ref: GithubRepoRef): HamzaGithubReader {
  return reader(token() ? new Octokit({ auth: token() }) : new Octokit(), ref);
}

/** Writer for the approval pipeline only. */
export function octokitWriter(ref: GithubRepoRef): HamzaGithubWriter {
  if (!token()) throw new Error("GITHUB_TOKEN is not set on the server.");
  // Defence in depth: no GitHub writes unless Hamza is fully configured (HAMZA_ENABLED=1 etc.; names only).
  const readiness = hamzaReadiness();
  if (!readiness.ready) throw new Error(`Hamza is not configured (missing: ${readiness.missing.join(", ")}).`);
  const kit = new Octokit({ auth: token() });
  const { owner, repo } = ref;
  const base = reader(kit, ref);
  return {
    ...base,
    async createBranch(branch, sha) {
      assertAgentWritableBranch(branch);
      await kit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha });
    },
    async commitTree({ branch, parentSha, message, files }) {
      assertAgentWritableBranch(branch);
      const parent = await kit.git.getCommit({ owner, repo, commit_sha: parentSha });
      const tree = await kit.git.createTree({
        owner,
        repo,
        base_tree: parent.data.tree.sha,
        tree: files.map((file) =>
          file.content === null
            ? { path: file.path, mode: "100644" as const, type: "blob" as const, sha: null }
            : { path: file.path, mode: "100644" as const, type: "blob" as const, content: file.content },
        ),
      });
      const commit = await kit.git.createCommit({ owner, repo, message, tree: tree.data.sha, parents: [parentSha] });
      await kit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.data.sha, force: false });
      return { sha: commit.data.sha, url: commit.data.html_url || `https://github.com/${owner}/${repo}/commit/${commit.data.sha}` };
    },
    async findOpenPrByHead(head) {
      const res = await kit.pulls.list({ owner, repo, state: "open", head: `${owner}:${head}`, per_page: 5 });
      return res.data[0] ? toPr(res.data[0]) : null;
    },
    async openPr({ head, base: target, title, body }) {
      assertAgentWritableBranch(head);
      const res = await kit.pulls.create({ owner, repo, head, base: target, title, body, draft: false });
      return toPr(res.data);
    },
    async mergePr({ prNumber, sha, title, message }) {
      const pr = await base.getPr(prNumber);
      if (!pr) throw new Error(`PR #${prNumber} not found.`);
      assertAgentWritableBranch(pr.headRef);
      if (pr.baseRef !== hamzaConfig().baseBranch.branch) throw new Error(`PR #${prNumber} does not target the Hamza base branch.`);
      const res = await kit.pulls.merge({ owner, repo, pull_number: prNumber, sha, merge_method: "squash", commit_title: title, commit_message: message });
      return { sha: res.data.sha };
    },
    async closePr(prNumber) {
      await kit.pulls.update({ owner, repo, pull_number: prNumber, state: "closed" });
    },
  };
}
