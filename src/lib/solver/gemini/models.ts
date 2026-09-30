/**
 * Shared Gemini model lists. Every server route that calls Gemini should use these
 * instead of hard-coding a model id (retired ids 404: gemini-1.5-flash, gemini-2.5-flash).
 */
import type { SolverLevel } from "../curriculum/types.ts";

/** Model tier: "fast" (middle school, SAT) may fall back to flash-lite; "strong" never does. */
export type ModelTier = "fast" | "strong";

/** Best available first. Pro models need a paid key (free tier quota is 0 → skipped instantly). */
const STRONG_DEFAULT = [
  "gemini-pro-latest",
  "gemini-3.1-pro-preview",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
] as const;

const FAST_DEFAULT = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-lite-latest"] as const;

function envList(name: string): string[] | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const list = raw.split(",").map((item) => item.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

export function isLiteModel(model: string): boolean {
  return /lite/i.test(model);
}

/** Ordered fallback list for a tier. GEMINI_MODEL pins one model (lite is still refused for strong). */
export function modelsForTier(tier: ModelTier): string[] {
  const pinned = process.env.GEMINI_MODEL?.trim();
  const override = envList(tier === "strong" ? "GEMINI_STRONG_MODELS" : "GEMINI_FAST_MODELS");
  const base = override ?? [...(tier === "strong" ? STRONG_DEFAULT : FAST_DEFAULT)];
  const list = pinned ? [pinned, ...base.filter((model) => model !== pinned)] : base;
  return tier === "strong" ? list.filter((model) => !isLiteModel(model)) : list;
}

/** General-purpose list (chat, transcription, classifiers): the fast tier. */
export function geminiModels(): string[] {
  return modelsForTier("fast");
}

export function tierForLevel(level: SolverLevel, options: { satAct?: boolean } = {}): ModelTier {
  if (level === "middle") return "fast";
  if (options.satAct) return "fast";
  return "strong";
}
