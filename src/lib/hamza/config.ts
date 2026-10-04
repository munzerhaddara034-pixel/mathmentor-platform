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
