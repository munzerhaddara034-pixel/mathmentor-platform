/**
 * The only GitHub surface Hamza uses. The agent loop gets a HamzaGithubReader (read-only tools); only the
 * approval pipeline (src/lib/hamza/pipeline.ts) ever receives a HamzaGithubWriter.
 */

export type PrInfo = {
  number: number;
  url: string;
  title: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
};

export type CheckRunInfo = {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  url?: string;
  startedAt?: string;
  completedAt?: string;
  /** GitHub Actions job id (the check-run id for Actions jobs). */
  jobId?: number;
};

export type CommitInfo = { sha: string; message: string; author: string; date: string; url: string };

export type RepoFileAtRef = { path: string; sha: string; content: string; size: number };

/** content === null deletes the path in the new tree. */
export type TreeWrite = { path: string; content: string | null };

export interface HamzaGithubReader {
  readonly repoLabel: string;
  getBranchSha(branch: string): Promise<string | null>;
  readFile(path: string, ref: string): Promise<RepoFileAtRef | null>;
  listCommits(input: { ref: string; path?: string; n: number }): Promise<CommitInfo[]>;
  listOpenPrs(): Promise<PrInfo[]>;
  getPr(prNumber: number): Promise<PrInfo | null>;
  listCheckRuns(sha: string): Promise<CheckRunInfo[]>;
  getJobLog(jobId: number): Promise<string>;
}

export interface HamzaGithubWriter extends HamzaGithubReader {
  createBranch(branch: string, sha: string): Promise<void>;
  /** One atomic commit on `branch` whose parent is `parentSha` (fast-forward only, never forced). */
  commitTree(input: { branch: string; parentSha: string; message: string; files: TreeWrite[] }): Promise<{ sha: string; url: string }>;
  findOpenPrByHead(head: string): Promise<PrInfo | null>;
  openPr(input: { head: string; base: string; title: string; body: string }): Promise<PrInfo>;
  /** Squash-merge, only if the PR head is still exactly `sha` (the commit CI checked). */
  mergePr(input: { prNumber: number; sha: string; title: string; message: string }): Promise<{ sha: string }>;
  closePr(prNumber: number): Promise<void>;
}
