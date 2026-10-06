/**
 * Hamza («حمزة», the /admin/team developer agent): every env-driven setting in one place.
 * Dependency-free and pure (an env map can be injected), so it is unit-tested and importable from scripts.
 *
 * Base branch: ONE variable with ONE meaning. `HAMZA_BASE_BRANCH` is the PR target and must equal the
 * branch Render deploys. `GITHUB_BRANCH` is only a legacy fallback (it meant three different things in
 * three files); the code default is `agent-hub-latest`, never `main`.
 */

export type EnvMap = Record<string, string | undefined>;

export const DEFAULT_HAMZA_BASE_BRANCH = "agent-hub-latest";

const BRANCH_RE = /^(?!.*\.\.)(?!.*\/\/)(?!.*@\{)[A-Za-z0-9][A-Za-z0-9._/-]{1,80}$/;

export type BaseBranchSource = "HAMZA_BASE_BRANCH" | "GITHUB_BRANCH" | "default";

export type HamzaBaseBranch = { branch: string; source: BaseBranchSource; warning?: string };

function env(source: EnvMap | undefined): EnvMap {
  return source ?? (typeof process !== "undefined" ? process.env : {});
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/** The PR target / live branch. Invalid names fall through to the next source (with a warning). */
export function hamzaBaseBranch(source?: EnvMap): HamzaBaseBranch {
  const vars = env(source);
  const explicit = clean(vars.HAMZA_BASE_BRANCH);
  const legacy = clean(vars.GITHUB_BRANCH);
  if (explicit && BRANCH_RE.test(explicit)) return { branch: explicit, source: "HAMZA_BASE_BRANCH" };
  const warning = explicit ? `HAMZA_BASE_BRANCH "${explicit.slice(0, 80)}" is not a valid branch name.` : undefined;
  if (legacy && BRANCH_RE.test(legacy)) {
    return {
      branch: legacy,
      source: "GITHUB_BRANCH",
      warning: warning ?? "HAMZA_BASE_BRANCH is unset; using the legacy GITHUB_BRANCH. Set HAMZA_BASE_BRANCH to the branch Render deploys.",
    };
  }
  return {
    branch: DEFAULT_HAMZA_BASE_BRANCH,
    source: "default",
    warning: warning ?? `HAMZA_BASE_BRANCH is unset; defaulting to ${DEFAULT_HAMZA_BASE_BRANCH}.`,
  };
}

/** Branches Hamza must never write to directly: the base branch plus whatever legacy GITHUB_BRANCH names. */
export function hamzaLiveBranches(source?: EnvMap): string[] {
  const vars = env(source);
  const legacy = clean(vars.GITHUB_BRANCH);
  return [...new Set([hamzaBaseBranch(vars).branch, ...(legacy && BRANCH_RE.test(legacy) ? [legacy] : [])])];
}

// ---------------------------------------------------------------------------------------------
// Everything else Hamza reads from the environment. Model ids are NEVER hard-coded at call sites:
// they come from HAMZA_MODEL_PRIMARY / HAMZA_MODEL_FALLBACKS / HAMZA_MODEL_CHEAP (see docs/HAMZA.md).
// ---------------------------------------------------------------------------------------------

export type ModelProvider = "gemini" | "openai";
export type ModelSpec = { provider: ModelProvider; model: string; id: string };

export type HamzaConfig = {
  enabled: boolean;
  workerEnabled: boolean;
  baseBranch: HamzaBaseBranch;
  liveBranches: string[];
  /** Status-check names that must be green before merge (job names in .github/workflows/hamza-ci.yml). */
  ciChecks: string[];
  codeTtlMinutes: number;
  maxCodeAttempts: number;
  maxRepairRounds: number;
  budgets: { taskUsd: number; taskMaxUsd: number; monthlyUsd: number };
  limits: { maxToolCalls: number; taskTimeoutMinutes: number; maxSteps: number };
  models: { primary: ModelSpec[]; fallbacks: ModelSpec[]; cheap: ModelSpec[]; configured: boolean };
  /** Who may merge to live (Approval #2). Empty = same list as Approval #1 (TEAM_APPROVER_EMAILS / ADMIN_EMAILS). */
  mergeApproverEmails: string[];
};

function num(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(clean(raw));
  if (!clean(raw) || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function list(raw: string | undefined): string[] {
  return clean(raw)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const OPENAI_MODEL_RE = /^(gpt-|o\d|codex)/i;
const MODEL_ID_RE = /^[A-Za-z0-9._:-]{2,80}$/;

/** "gemini:gemini-3.1-pro-preview", "openai:gpt-5.3-codex" or a bare id (provider inferred from the name). */
export function parseModelSpec(raw: string): ModelSpec | null {
  const value = raw.trim();
  if (!MODEL_ID_RE.test(value)) return null;
  const match = value.match(/^(gemini|google|openai):(.+)$/i);
  if (match) {
    const provider: ModelProvider = match[1].toLowerCase() === "openai" ? "openai" : "gemini";
    return { provider, model: match[2], id: `${provider}:${match[2]}` };
  }
  const provider: ModelProvider = OPENAI_MODEL_RE.test(value) ? "openai" : "gemini";
  return { provider, model: value, id: `${provider}:${value}` };
}

export function parseModelList(raw: string | undefined): ModelSpec[] {
  const seen = new Set<string>();
  const out: ModelSpec[] = [];
  for (const item of list(raw)) {
    const spec = parseModelSpec(item);
    if (spec && !seen.has(spec.id)) {
      seen.add(spec.id);
      out.push(spec);
    }
  }
  return out;
}

export function hamzaConfig(source?: EnvMap): HamzaConfig {
  const vars = env(source);
  const taskUsd = num(vars.HAMZA_TASK_BUDGET_USD, 2, 0.05, 50);
  const primary = parseModelList(vars.HAMZA_MODEL_PRIMARY);
  const fallbacks = parseModelList(vars.HAMZA_MODEL_FALLBACKS);
  const cheap = parseModelList(vars.HAMZA_MODEL_CHEAP);
  return {
    enabled: clean(vars.HAMZA_ENABLED) !== "0",
    workerEnabled: clean(vars.HAMZA_WORKER) !== "0",
    baseBranch: hamzaBaseBranch(vars),
    liveBranches: hamzaLiveBranches(vars),
    ciChecks: list(vars.HAMZA_CI_CHECKS).length ? list(vars.HAMZA_CI_CHECKS) : ["hamza-ci"],
    codeTtlMinutes: num(vars.HAMZA_CODE_TTL_MINUTES, 30, 5, 120),
    maxCodeAttempts: num(vars.HAMZA_CODE_MAX_ATTEMPTS, 5, 1, 10),
    // The plan caps automatic CI repair at 2 rounds; env can lower it, never raise it.
    maxRepairRounds: Math.round(num(vars.HAMZA_MAX_REPAIR_ROUNDS, 2, 0, 2)),
    budgets: {
      taskUsd,
      taskMaxUsd: Math.max(taskUsd, num(vars.HAMZA_TASK_BUDGET_MAX_USD, 5, 0.05, 100)),
      monthlyUsd: num(vars.HAMZA_MONTHLY_BUDGET_USD, 60, 1, 1000),
    },
    limits: {
      maxToolCalls: Math.round(num(vars.HAMZA_MAX_TOOL_CALLS, 40, 5, 120)),
      taskTimeoutMinutes: num(vars.HAMZA_TASK_TIMEOUT_MINUTES, 15, 2, 60),
      maxSteps: Math.round(num(vars.HAMZA_MAX_STEPS, 24, 4, 80)),
    },
    models: { primary, fallbacks, cheap, configured: primary.length > 0 },
    mergeApproverEmails: list(vars.HAMZA_MERGE_APPROVER_EMAILS).map((email) => email.toLowerCase()),
  };
}
