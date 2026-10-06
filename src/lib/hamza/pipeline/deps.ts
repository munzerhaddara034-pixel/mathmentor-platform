/** Production wiring of the pipeline: team store, Octokit, mm_audit_log, env config, approver lists. */
import { isTeamApproverEmail } from "@/lib/auth/adminAllowlist";
import { teamGithubConfig } from "@/lib/team/github";
import { teamRepo } from "@/lib/team/store";
import { hamzaAudit } from "../audit";
import { hamzaRuntimeConfig } from "../readiness";
import { githubTokenPresent, octokitReader, octokitWriter } from "../github/octokit";
import type { PipelineActor, PipelineDeps } from "./shared";

type DepsGlobal = { mmHamzaDepsOverride?: Partial<PipelineDeps> | null; mmHamzaCiFailed?: PipelineDeps["onCiFailed"] };
const globalForDeps = globalThis as unknown as DepsGlobal;

/** Test hook only (scripts/test-team-chat.ts). */
export function setPipelineDepsOverride(override: Partial<PipelineDeps> | null): void {
  globalForDeps.mmHamzaDepsOverride = override;
}

/** The repair loop registers itself here (avoids an import cycle with the task runner). */
export function setCiFailedHandler(handler: PipelineDeps["onCiFailed"]): void {
  globalForDeps.mmHamzaCiFailed = handler;
}

export function canMergeToLive(actor: Pick<PipelineActor, "email">, mergeApprovers = hamzaRuntimeConfig().mergeApproverEmails): boolean {
  const email = actor.email.trim().toLowerCase();
  if (!isTeamApproverEmail(email)) return false;
  return mergeApprovers.length ? mergeApprovers.includes(email) : true;
}

export function pipelineDeps(): PipelineDeps {
  const config = hamzaRuntimeConfig();
  const ref = teamGithubConfig();
  const repoRef = { owner: ref.owner, repo: ref.repo };
  const base: PipelineDeps = {
    repo: teamRepo(),
    writer: () => octokitWriter(repoRef),
    reader: () => (githubTokenPresent() ? octokitWriter(repoRef) : octokitReader(repoRef)),
    audit: hamzaAudit,
    now: () => new Date(),
    config,
    canApprove: (actor) => isTeamApproverEmail(actor.email),
    canMerge: (actor) => canMergeToLive(actor, config.mergeApproverEmails),
    onCiFailed: globalForDeps.mmHamzaCiFailed,
  };
  return { ...base, ...(globalForDeps.mmHamzaDepsOverride ?? {}) };
}
