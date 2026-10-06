/** Runner dependencies (production: ./deps.ts; tests inject memory repos + scripted models). */
import type { TeamRepo } from "@/lib/team/repo";
import type { HamzaAuditFn } from "../audit";
import type { HamzaConfig } from "../config";
import type { SyntaxFn } from "../agent/prechecks";
import type { HamzaGithubReader } from "../github/types";
import type { RouterResult } from "../models/router";
import type { RouterRequest } from "../models/providers";
import type { RepoSnapshot } from "../snapshot";
import type { HamzaTaskRepo } from "../tasks/types";

export type RunnerDeps = {
  teamRepo: TeamRepo;
  tasks: HamzaTaskRepo;
  config: HamzaConfig;
  audit: HamzaAuditFn;
  now: () => Date;
  /** Read-only GitHub (null = not reachable / local mode). */
  reader: () => HamzaGithubReader | null;
  /** Snapshot of `ref` at its current head SHA. */
  openSnapshot: (ref: string) => Promise<RepoSnapshot>;
  call: (request: RouterRequest) => Promise<RouterResult>;
  systemPrompt: string;
  repoLabel: string;
  modelNotice?: string;
  syntax?: SyntaxFn;
};
