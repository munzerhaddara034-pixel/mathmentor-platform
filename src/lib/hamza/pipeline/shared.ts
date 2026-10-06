/**
 * Shared pieces of the approval pipeline. The pipeline is the ONLY code that calls GitHub write APIs,
 * and only after a human approval code (Approval #1 → PR, Approval #2 → merge).
 * Dependencies are injected (tests use an in-memory repo + fake GitHub; production: ./deps.ts).
 */
import { createId } from "@/lib/ids";
import type { TeamRepo } from "@/lib/team/repo";
import type { TeamMessage, TeamProposal, TeamProposalFile, TeamProposalStatus } from "@/lib/team/types";
import type { HamzaAuditFn } from "../audit";
import type { HamzaConfig } from "../config";
import { computeDiffHash } from "../diffHash";
import type { HamzaGithubReader, HamzaGithubWriter, TreeWrite } from "../github/types";
import { proposalTier, riskLevel } from "../limits";
import type { HamzaPipelineState } from "../types";

export type PipelineActor = { id: string; name: string; email: string; role: string; ip?: string };

export type PipelineDeps = {
  repo: TeamRepo;
  writer: () => HamzaGithubWriter;
  reader: () => HamzaGithubReader;
  audit: HamzaAuditFn;
  now: () => Date;
  config: HamzaConfig;
  canApprove: (actor: PipelineActor) => boolean;
  canMerge: (actor: PipelineActor) => boolean;
  /** Called once when CI turns red; returns a note for the chat (e.g. "repair round 1/2 queued"). */
  onCiFailed?: (proposal: TeamProposal) => Promise<string | undefined>;
};

export type PipelineOk = { ok: true; proposal: TeamProposal; message?: TeamMessage; code?: string; expiresAt?: string };
export type PipelineFail = { ok: false; status: number; error: string; errorAr: string; proposal?: TeamProposal };
export type PipelineResult = PipelineOk | PipelineFail;

export function fail(status: number, error: string, errorAr: string, proposal?: TeamProposal): PipelineFail {
  return { ok: false, status, error, errorAr, proposal };
}

export function proposalDiffHash(files: TeamProposalFile[]): string {
  return computeDiffHash(files);
}

export function initialHamzaState(proposal: Pick<TeamProposal, "files" | "createdAt">, extra?: Partial<HamzaPipelineState>): HamzaPipelineState {
  const tier = proposalTier(proposal.files);
  return {
    revision: 1,
    diffHash: proposalDiffHash(proposal.files),
    tier: tier.ok ? tier.tier : "large",
    riskLevel: riskLevel(proposal.files),
    repairRounds: 0,
    codes: {},
    timeline: [{ at: proposal.createdAt, kind: "proposed" }],
    ...extra,
  };
}

/** Old rows (pre-v2) get a state on first use. */
export function stateOf(proposal: TeamProposal): HamzaPipelineState {
  return proposal.hamza ?? initialHamzaState(proposal);
}

export async function postSystem(deps: PipelineDeps, proposal: TeamProposal, text: string, notice?: string): Promise<TeamMessage> {
  const message: TeamMessage = {
    id: createId("tmsg"),
    channel: proposal.channel,
    authorKind: "system",
    authorId: "system",
    authorName: "المنصة",
    text,
    attachments: [],
    createdAt: deps.now().toISOString(),
    proposalId: proposal.id,
    notice,
  };
  await deps.repo.addMessage(message);
  return message;
}

export async function save(
  deps: PipelineDeps,
  proposal: TeamProposal,
  from: TeamProposalStatus[],
  status: TeamProposalStatus,
  patch: Partial<TeamProposal> = {},
): Promise<TeamProposal | undefined> {
  return deps.repo.transitionProposal(proposal.id, from, { ...patch, status });
}

/** Git tree entries for a patch: content=null deletes; a rename deletes the old path and writes the new one. */
export function treeWrites(files: TeamProposalFile[]): TreeWrite[] {
  const out: TreeWrite[] = [];
  for (const file of files) {
    if (file.change === "delete") out.push({ path: file.path, content: null });
    else if (file.change === "rename" && file.oldPath) out.push({ path: file.oldPath, content: null }, { path: file.path, content: file.newContent });
    else out.push({ path: file.path, content: file.newContent });
  }
  return out;
}

/** Conflict guard: every touched file must still be the blob the diff was computed against. */
export async function conflictCheck(github: HamzaGithubReader, ref: string, files: TeamProposalFile[]): Promise<string | null> {
  for (const file of files) {
    const source = file.change === "rename" && file.oldPath ? file.oldPath : file.path;
    const current = await github.readFile(source, ref);
    if ((current?.sha ?? null) !== file.baseSha) return source;
    if (file.change === "rename" && (await github.readFile(file.path, ref))) return file.path;
  }
  return null;
}

export function shortList(files: TeamProposalFile[]): string {
  return files
    .map((file) => (file.change === "rename" && file.oldPath ? `${file.oldPath} → ${file.path}` : file.path))
    .slice(0, 12)
    .join("، ");
}
