/**
 * Read-only GitHub access for the developer agent (tree + files of the base branch) and the shared repo
 * config. Built on the same Octokit + env contract as src/lib/agent/githubCommit.ts.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { Octokit } from "@octokit/rest";
import { githubCommitConfig } from "@/lib/agent/githubCommit";
import { hamzaBaseBranch, hamzaLiveBranches } from "@/lib/hamza/config";

export type TeamGithubConfig = {
  owner: string;
  repo: string;
  /** Base / live branch (Render builds it): HAMZA_BASE_BRANCH, legacy fallback GITHUB_BRANCH. */
  baseBranch: string;
  tokenPresent: boolean;
};

/** Branches the in-platform agent may never write to. */
export const FORBIDDEN_BRANCHES = ["main", "master"];
/** Old live branch — never writable by agents (see src/lib/security/agentBranches.ts). */
export const LEGACY_PROTECTED_BRANCHES = ["cursor/platform-shell-auth-dashboard-2f19"];

function token(): string {
  return process.env.GITHUB_TOKEN?.trim() || "";
}

export function teamGithubConfig(): TeamGithubConfig {
  const base = githubCommitConfig();
  return {
    owner: process.env.GITHUB_OWNER?.trim() || base.owner || "munzerhaddara034-pixel",
    repo: process.env.GITHUB_REPO?.trim() || base.repo || "mathmentor-platform",
    baseBranch: hamzaBaseBranch().branch,
    tokenPresent: Boolean(token()),
  };
}

export function isProtectedBranch(branch: string, config = teamGithubConfig()): boolean {
  return (
    branch === config.baseBranch ||
    hamzaLiveBranches().includes(branch) ||
    LEGACY_PROTECTED_BRANCHES.includes(branch) ||
    FORBIDDEN_BRANCHES.includes(branch)
  );
}

const BRANCH_RE = /^(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9][A-Za-z0-9._\/-]{1,80}$/;

export function isValidBranchName(branch: string): boolean {
  return BRANCH_RE.test(branch) && !branch.endsWith("/") && !branch.endsWith(".lock");
}

function octokit(): Octokit {
  // Public repos can be read anonymously; writes always require GITHUB_TOKEN.
  return token() ? new Octokit({ auth: token() }) : new Octokit();
}

const run = promisify(execFile);

/**
 * Local development / tests: TEAM_REPO_LOCAL_DIR=/path/to/clone reads the base branch from a local git
 * checkout (`git ls-tree` / `git show`) instead of the GitHub API. Commits still go through the API.
 */
function localRepoDir(): string {
  return process.env.TEAM_REPO_LOCAL_DIR?.trim() || "";
}

function gitBlobSha(content: Buffer): string {
  return createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}

async function localListFiles(dir: string, branch: string): Promise<string[]> {
  const { stdout } = await run("git", ["-C", dir, "ls-tree", "-r", "--name-only", branch], { maxBuffer: 16 * 1024 * 1024 });
  return stdout.split("\n").filter(Boolean);
}

async function localReadFile(dir: string, branch: string, path: string): Promise<RepoFile | null> {
  try {
    const { stdout } = await run("git", ["-C", dir, "show", `${branch}:${path}`], {
      encoding: "buffer",
      maxBuffer: 8 * 1024 * 1024,
    });
    const bytes = Buffer.from(stdout);
    return { path, sha: gitBlobSha(bytes), content: bytes.toString("utf8"), size: bytes.length };
  } catch {
    return null;
  }
}

export async function listRepoFiles(config = teamGithubConfig()): Promise<string[]> {
  if (localRepoDir()) return localListFiles(localRepoDir(), config.baseBranch);
  const kit = octokit();
  const ref = await kit.git.getRef({ owner: config.owner, repo: config.repo, ref: `heads/${config.baseBranch}` });
  const tree = await kit.git.getTree({
    owner: config.owner,
    repo: config.repo,
    tree_sha: ref.data.object.sha,
    recursive: "true",
  });
  return tree.data.tree
    .filter((item) => item.type === "blob" && typeof item.path === "string")
    .map((item) => item.path as string);
}

export type RepoFile = { path: string; sha: string; content: string; size: number };

export async function readRepoFile(path: string, config = teamGithubConfig()): Promise<RepoFile | null> {
  if (localRepoDir()) return localReadFile(localRepoDir(), config.baseBranch, path);
  try {
    const res = await octokit().repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path,
      ref: config.baseBranch,
    });
    if (Array.isArray(res.data) || res.data.type !== "file") return null;
    const content = Buffer.from(res.data.content ?? "", "base64").toString("utf8");
    return { path, sha: res.data.sha, content, size: res.data.size };
  } catch {
    return null;
  }
}

// Writes (branch, commit, PR, merge) live in src/lib/hamza/github/octokit.ts and are reached only through
// the approval pipeline (src/lib/hamza/pipeline) after an in-app approval code.
