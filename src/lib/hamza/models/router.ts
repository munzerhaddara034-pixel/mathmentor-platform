/**
 * ModelRouter: tries the configured chain in order and falls back on 429 / 5xx / timeouts / network
 * errors / empty or malformed JSON answers. Records which model served each step, tokens and USD.
 * Chain: HAMZA_MODEL_PRIMARY → HAMZA_MODEL_FALLBACKS (tier "primary"); HAMZA_MODEL_CHEAP → fallbacks →
 * primary (tier "cheap"). When HAMZA_MODEL_PRIMARY is unset the legacy team chain is used (with a notice).
 */
import { parseModelSpec, type HamzaConfig, type ModelSpec } from "../config";
import { parseJsonObject } from "../json";
import { usageCostUsd, type TokenUsage } from "./pricing";
import { httpTransport, type RouterRequest, type Transport } from "./providers";

export type ModelTier = "primary" | "cheap";

export type RouterAttempt = { model: string; ok: boolean; error?: string };

export type RouterResult = {
  text: string;
  json: Record<string, unknown> | null;
  model: string;
  usage: TokenUsage;
  usd: number;
  attempts: RouterAttempt[];
};

export class ModelChainExhaustedError extends Error {
  readonly attempts: RouterAttempt[];
  constructor(attempts: RouterAttempt[]) {
    super(`All models failed: ${attempts.map((a) => `${a.model} (${a.error ?? "?"})`).join("; ")}`.slice(0, 600));
    this.name = "ModelChainExhaustedError";
    this.attempts = attempts;
  }
}

function unique(specs: ModelSpec[]): ModelSpec[] {
  const seen = new Set<string>();
  return specs.filter((spec) => (seen.has(spec.id) ? false : (seen.add(spec.id), true)));
}

/** The ordered chain for a tier. `legacy` = the team chat's Gemini list when Hamza models are unset. */
export function modelChain(config: HamzaConfig, tier: ModelTier, legacy: string[] = []): ModelSpec[] {
  const { primary, fallbacks, cheap } = config.models;
  const legacySpecs = legacy.map((id) => parseModelSpec(id)).filter((spec): spec is ModelSpec => Boolean(spec));
  if (!primary.length && !cheap.length && !fallbacks.length) return legacySpecs;
  return unique(tier === "cheap" ? [...cheap, ...fallbacks, ...primary] : [...primary, ...fallbacks, ...cheap]);
}

export async function routeModelCall(input: {
  chain: ModelSpec[];
  request: RouterRequest;
  transport?: Transport;
  priceOf?: (model: string, usage: TokenUsage) => number;
}): Promise<RouterResult> {
  const transport = input.transport ?? httpTransport;
  const attempts: RouterAttempt[] = [];
  const total: TokenUsage = { inputTokens: 0, cachedTokens: 0, outputTokens: 0 };
  let usd = 0;
  for (const spec of input.chain) {
    try {
      const result = await transport(spec, input.request);
      // Failed attempts that still returned usage are billed too.
      total.inputTokens += result.usage.inputTokens;
      total.cachedTokens += result.usage.cachedTokens;
      total.outputTokens += result.usage.outputTokens;
      usd += (input.priceOf ?? usageCostUsd)(spec.model, result.usage);
      const json = input.request.json ? parseJsonObject(result.text) : null;
      if (!result.text) throw new Error("empty answer");
      if (input.request.json && !json) throw new Error("malformed JSON");
      attempts.push({ model: spec.id, ok: true });
      return { text: result.text, json, model: spec.id, usage: total, usd, attempts };
    } catch (error) {
      attempts.push({ model: spec.id, ok: false, error: error instanceof Error ? error.message.slice(0, 160) : "error" });
    }
  }
  throw new ModelChainExhaustedError(attempts);
}
