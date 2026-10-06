/**
 * USD per 1M tokens. This is a PRICE table (data), not a model choice: which models run comes only from
 * HAMZA_MODEL_* env vars. Override or extend with HAMZA_MODEL_PRICES='{"<model id>":{"in":2,"out":12,"cached":0.2}}'.
 * Unknown models are billed at HAMZA_DEFAULT_PRICE ("in,out", default "2,12") so budget caps still hold.
 * List prices as of 4 Oct 2026 (ai.google.dev/pricing, openai.com/api/pricing); update via env when they change.
 */
import type { EnvMap } from "../config";

export type ModelPrice = { in: number; out: number; cached: number };

const KNOWN: Record<string, ModelPrice> = {
  "gemini-3.1-pro-preview": { in: 2, out: 12, cached: 0.2 },
  "gemini-3.1-pro-preview-customtools": { in: 2, out: 12, cached: 0.2 },
  "gemini-3.8-flash": { in: 0.75, out: 3.75, cached: 0.075 },
  "gpt-5.3-codex": { in: 1.75, out: 14, cached: 0.175 },
  "gemini-flash-latest": { in: 0.3, out: 2.5, cached: 0.03 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5, cached: 0.03 },
};

function parsePrice(value: unknown): ModelPrice | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const input = Number(record.in);
  const output = Number(record.out);
  const cached = record.cached === undefined ? input / 10 : Number(record.cached);
  if (![input, output, cached].every((n) => Number.isFinite(n) && n >= 0)) return null;
  return { in: input, out: output, cached };
}

export function priceTable(source: EnvMap = process.env): { table: Record<string, ModelPrice>; fallback: ModelPrice } {
  const table: Record<string, ModelPrice> = { ...KNOWN };
  try {
    const raw: unknown = source.HAMZA_MODEL_PRICES ? JSON.parse(source.HAMZA_MODEL_PRICES) : {};
    if (raw && typeof raw === "object") {
      for (const [model, value] of Object.entries(raw as Record<string, unknown>)) {
        const price = parsePrice(value);
        if (price) table[model.replace(/^(gemini|google|openai):/, "")] = price;
      }
    }
  } catch {
    // Invalid JSON: keep the built-in table (logged by the caller's notice).
  }
  const [fin, fout] = (source.HAMZA_DEFAULT_PRICE ?? "2,12").split(",").map(Number);
  const fallback = Number.isFinite(fin) && Number.isFinite(fout) ? { in: fin, out: fout, cached: fin / 10 } : { in: 2, out: 12, cached: 0.2 };
  return { table, fallback };
}

export type TokenUsage = { inputTokens: number; cachedTokens: number; outputTokens: number };

export function usageCostUsd(model: string, usage: TokenUsage, prices = priceTable()): number {
  const price = prices.table[model] ?? prices.fallback;
  const cached = Math.min(usage.cachedTokens, usage.inputTokens);
  const usd = ((usage.inputTokens - cached) * price.in + cached * price.cached + usage.outputTokens * price.out) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
