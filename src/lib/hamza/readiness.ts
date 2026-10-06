/**
 * Hamza is OFF unless every required setting is present (disabled-by-default gate).
 * Pure and dependency-free (an env map can be injected), so it is unit-tested and importable from scripts.
 *
 * Required to turn Hamza on (names only are ever reported, never values):
 *   HAMZA_ENABLED=1 (explicit opt-in) · GITHUB_TOKEN · GITHUB_OWNER · GITHUB_REPO · HAMZA_BASE_BRANCH (valid)
 *   · HAMZA_MODEL_PRIMARY (valid) · the primary model's key (HAMZA_GEMINI_API_KEY / GEMINI_API_KEY, or OPENAI_API_KEY)
 * When any is missing: no worker, no new tasks, no approval / PR / merge / revert / revise / continue actions,
 * and /admin/team shows a "not configured" banner listing the missing names.
 */
import { hamzaConfig, parseModelList, type EnvMap, type HamzaConfig } from "./config";

export type HamzaReadiness = {
  ready: boolean;
  /** Env variable names (or "A or B" alternatives) that are missing or invalid. Never values. */
  missing: string[];
};

const BRANCH_RE = /^(?!.*\.\.)(?!.*\/\/)(?!.*@\{)[A-Za-z0-9][A-Za-z0-9._/-]{1,80}$/;
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const ON = new Set(["1", "true", "on", "yes"]);

type ReadinessGlobal = { mmHamzaReadinessOverride?: HamzaReadiness | null };
const globalForReadiness = globalThis as unknown as ReadinessGlobal;

/** Test hook only (scripts/test-team-chat.ts, tests/*). Production never sets it. */
export function setHamzaReadinessOverride(override: HamzaReadiness | null): void {
  globalForReadiness.mmHamzaReadinessOverride = override;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Pure check of an env map (no override). */
export function computeHamzaReadiness(vars: EnvMap): HamzaReadiness {
  const missing: string[] = [];
  if (!ON.has(clean(vars.HAMZA_ENABLED).toLowerCase())) missing.push("HAMZA_ENABLED=1");
  if (!clean(vars.GITHUB_TOKEN)) missing.push("GITHUB_TOKEN");
  if (!OWNER_RE.test(clean(vars.GITHUB_OWNER))) missing.push("GITHUB_OWNER");
  if (!REPO_RE.test(clean(vars.GITHUB_REPO))) missing.push("GITHUB_REPO");
  if (!BRANCH_RE.test(clean(vars.HAMZA_BASE_BRANCH))) missing.push("HAMZA_BASE_BRANCH");
  const primary = parseModelList(vars.HAMZA_MODEL_PRIMARY);
  if (!primary.length) missing.push("HAMZA_MODEL_PRIMARY");
  else if (primary[0].provider === "openai" && !clean(vars.OPENAI_API_KEY)) missing.push("OPENAI_API_KEY");
  else if (primary[0].provider === "gemini" && !clean(vars.HAMZA_GEMINI_API_KEY) && !clean(vars.GEMINI_API_KEY) && !clean(vars.GOOGLE_API_KEY)) {
    missing.push("HAMZA_GEMINI_API_KEY or GEMINI_API_KEY");
  }
  return { ready: missing.length === 0, missing };
}

/** Current readiness (process.env unless a map is injected; honours the test override). */
export function hamzaReadiness(source?: EnvMap): HamzaReadiness {
  if (!source && globalForReadiness.mmHamzaReadinessOverride) return globalForReadiness.mmHamzaReadinessOverride;
  return computeHamzaReadiness(source ?? (typeof process !== "undefined" ? process.env : {}));
}

export function hamzaNotConfiguredTextAr(readiness: HamzaReadiness): string {
  return (
    `حمزة غير مفعّل على هذا الخادم (غير مُعدّ). لم تُنشأ أي مهمة ولم يُستدعَ أي نموذج ولا GitHub. ` +
    `الإعدادات الناقصة: ${readiness.missing.join("، ")}. التفعيل يحتاج موافقة منذر وضبط هذه المتغيرات على Render (docs/HAMZA.md).`
  );
}

export const HAMZA_NOT_CONFIGURED_EN = "Hamza is not configured on this server (disabled).";

/** Production config: `enabled` (new tasks, worker ticks) is forced off unless Hamza is fully configured. */
export function hamzaRuntimeConfig(): HamzaConfig {
  const config = hamzaConfig();
  return { ...config, enabled: config.enabled && hamzaReadiness().ready };
}
