// Shared builders for Hamza pipeline tests.
import { hamzaConfig } from "../../src/lib/hamza/config.ts";
import { initialHamzaState } from "../../src/lib/hamza/pipeline/shared.ts";
import { unifiedDiff } from "../../src/lib/team/diff.ts";
import { createFakeGithub, gitBlobSha } from "./fakeGithub.mjs";
import { createMemoryTeamRepo } from "./memoryTeamRepo.mjs";

export const BASE_FILES = {
  "src/components/Hello.tsx": 'export function Hello() {\n  return <p>Hello</p>;\n}\n',
  "src/lib/old.ts": "export const old = 1;\n",
  "docs/notes.md": "# Notes\n",
};

export const approver = { id: "u-munzer", name: "Munzer", email: "munzer@example.com", role: "admin", ip: "10.0.0.1" };
export const outsider = { id: "u-x", name: "X", email: "x@example.com", role: "teacher" };

export function fileChange(path, before, after, extra = {}) {
  const d = unifiedDiff(path, before, after);
  return {
    path,
    baseSha: before === null ? null : gitBlobSha(before),
    isNew: before === null,
    newContent: after,
    oldContent: before ?? undefined,
    diff: d.text,
    additions: d.additions,
    deletions: d.deletions,
    change: before === null ? "add" : "modify",
    ...extra,
  };
}

export function makeProposal(files, overrides = {}) {
  const now = "2026-10-04T20:00:00.000Z";
  const proposal = {
    id: overrides.id ?? `prop-${Math.random().toString(36).slice(2, 8)}`,
    channel: "developer",
    messageId: "tmsg-1",
    requestText: "change hello",
    requestedBy: "Munzer",
    summaryAr: "تعديل",
    risksAr: "",
    testPlanAr: "",
    commitMessage: "feat: say hi",
    baseBranch: "agent-hub-latest",
    targetBranch: "feat/say-hi",
    files,
    status: "pending",
    checks: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  proposal.hamza = initialHamzaState(proposal, overrides.hamzaExtra);
  delete proposal.hamzaExtra;
  return proposal;
}

export function makeDeps(options = {}) {
  const github = options.github ?? createFakeGithub(BASE_FILES);
  const repo = options.repo ?? createMemoryTeamRepo();
  const audits = [];
  let clock = options.now ?? new Date("2026-10-04T20:00:00Z");
  const deps = {
    repo,
    writer: () => github,
    reader: () => github,
    audit: async (action, input) => {
      audits.push({ action, ...input });
    },
    now: () => clock,
    config: hamzaConfig({ HAMZA_BASE_BRANCH: "agent-hub-latest", ...(options.env ?? {}) }),
    canApprove: (actor) => actor.email === approver.email,
    canMerge: (actor) => actor.email === approver.email,
    onCiFailed: options.onCiFailed,
  };
  return {
    deps,
    github,
    repo,
    audits,
    advance(ms) {
      clock = new Date(clock.getTime() + ms);
    },
  };
}

export const run = (id, name, status, conclusion) => ({ id, name, status, conclusion, jobId: id });
