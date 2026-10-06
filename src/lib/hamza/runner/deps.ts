/** Production wiring for the runner + worker: env config, team store, task store, GitHub reader, ModelRouter. */
import { teamGithubConfig } from "@/lib/team/github";
import { callTeamLlm, teamModels } from "@/lib/team/gemini";
import { DEVELOPER_SYSTEM_PROMPT_AR } from "@/lib/team/prompts";
import { teamRepo } from "@/lib/team/store";
import { hamzaAudit } from "../audit";
import type { ModelSpec } from "../config";
import { hamzaRuntimeConfig } from "../readiness";
import { githubTokenPresent, octokitReader, octokitWriter } from "../github/octokit";
import { modelChain, routeModelCall } from "../models/router";
import { httpTransport, type RouterRequest, type Transport } from "../models/providers";
import { pipelineDeps } from "../pipeline/deps";
import { refreshCi } from "../pipeline/ciRefresh";
import type { RepoSnapshot } from "../snapshot";
import { githubTarballSnapshot, gitSnapshot, localGitSha } from "../snapshotSources";
import { hamzaTaskRepo } from "../tasks/store";
import type { WorkerDeps } from "../worker";
import type { RunnerDeps } from "./types";

const globalForLlm = globalThis as unknown as { mmTeamLlmOverride?: unknown };

/** Honours the team-chat test hook (setTeamLlmOverride) so offline tests never reach a provider. */
const transport: Transport = async (spec: ModelSpec, request: RouterRequest) => {
  if (!globalForLlm.mmTeamLlmOverride) return httpTransport(spec, request);
  const text = await callTeamLlm({
    agent: `developer:${request.step}`,
    system: request.system,
    turns: request.turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    json: request.json,
    temperature: request.temperature,
  });
  return { text, usage: { inputTokens: 0, cachedTokens: 0, outputTokens: 0 } };
};

async function openSnapshot(ref: string): Promise<RepoSnapshot> {
  const local = process.env.TEAM_REPO_LOCAL_DIR?.trim();
  if (local) return gitSnapshot(local, ref, await localGitSha(local, ref));
  const repo = teamGithubConfig();
  const reader = githubTokenPresent() ? octokitWriter(repo) : octokitReader(repo);
  const sha = await reader.getBranchSha(ref);
  if (!sha) throw new Error(`Branch ${ref} not found on GitHub.`);
  return githubTarballSnapshot({ owner: repo.owner, repo: repo.repo, ref, sha });
}

export function runnerDeps(): RunnerDeps {
  const config = hamzaRuntimeConfig();
  const repo = teamGithubConfig();
  const chain = modelChain(config, "primary", teamModels());
  return {
    teamRepo: teamRepo(),
    tasks: hamzaTaskRepo(),
    config,
    audit: hamzaAudit,
    now: () => new Date(),
    reader: () => {
      if (process.env.TEAM_REPO_LOCAL_DIR?.trim()) return null;
      return githubTokenPresent() ? octokitWriter(repo) : octokitReader(repo);
    },
    openSnapshot,
    call: (request) => routeModelCall({ chain, request, transport }),
    systemPrompt: DEVELOPER_SYSTEM_PROMPT_AR,
    repoLabel: `${repo.owner}/${repo.repo}`,
    modelNotice: config.models.configured ? undefined : "HAMZA_MODEL_PRIMARY غير معرّف — استُعملت سلسلة نماذج الدردشة (Gemini Flash). اضبط نماذج حمزة للحصول على أفضل جودة.",
  };
}

export function workerDeps(): WorkerDeps {
  return {
    config: hamzaRuntimeConfig(),
    tasks: hamzaTaskRepo(),
    teamRepo: teamRepo(),
    now: () => new Date(),
    runner: runnerDeps,
    refreshCi: (proposalId) => refreshCi(pipelineDeps(), { proposalId }),
  };
}

