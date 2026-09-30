/**
 * Minimal Gemini generateContent client with retry/backoff, per-call timeout, total deadline,
 * token caps and usage accounting. Never logs or returns the API key.
 */
import { isLiteModel, modelsForTier, type ModelTier } from "./models.ts";
import { costUsd } from "./pricing.ts";

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export type ThinkingLevel = "low" | "medium" | "high";

export type GenerateOptions = {
  parts: GeminiPart[];
  tier: ModelTier;
  thinking: ThinkingLevel;
  maxOutputTokens: number;
  /** Total wall-clock budget across retries and fallbacks. */
  deadlineMs: number;
  /** Per-HTTP-call timeout. */
  callTimeoutMs: number;
  json?: boolean;
  /** Override model list (tests, routes). */
  models?: string[];
};

export type CallRecord = {
  model: string;
  status: number;
  ms: number;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
  note?: string;
};

export type GenerateResult = { text: string; model: string; calls: CallRecord[] };

type GeminiResponse = {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
};

export class GeminiError extends Error {
  readonly calls: CallRecord[];
  constructor(message: string, calls: CallRecord[]) {
    super(message);
    this.name = "GeminiError";
    this.calls = calls;
  }
}

export function geminiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
}

/** Models that answered "quota exhausted for the day" / "not found": skipped without a call for a while. */
const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 15 * 60_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Transient = worth retrying the same model. A hard quota of 0 (free tier on Pro) is not. */
function classify(status: number, body: string): "transient" | "skip" {
  if (status === 503 || status === 500 || status === 502 || status === 504) return "transient";
  if (status === 429) return /limit:\s*0\b/.test(body) || /per ?day|PerDay/i.test(body) ? "skip" : "transient";
  return "skip";
}

function retryDelayMs(body: string, attempt: number): number {
  const hinted = body.match(/retry in ([\d.]+)s/i)?.[1] ?? body.match(/"retryDelay":\s*"(\d+)s"/)?.[1];
  const base = 1000 * 2 ** attempt + Math.floor(Math.random() * 300);
  const hint = hinted ? Math.ceil(Number(hinted) * 1000) : 0;
  return Math.min(Math.max(base, hint), 8000);
}

function responseText(json: GeminiResponse): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("\n");
}

async function callOnce(model: string, key: string, options: GenerateOptions, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: options.parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: options.maxOutputTokens,
          ...(options.json === false ? {} : { responseMimeType: "application/json" }),
          thinkingConfig: { thinkingLevel: options.thinking },
        },
      }),
    });
    const body = await response.text();
    return { status: response.status, body, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

/** First good response along the tier's model list. Throws GeminiError with the call log. */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const key = geminiKey();
  const calls: CallRecord[] = [];
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set.", calls);
  const models = (options.models ?? modelsForTier(options.tier)).filter(
    (model) => options.tier !== "strong" || !isLiteModel(model),
  );
  const started = Date.now();
  // Strong tier: retry a transient 503/429 twice with backoff before falling back.
  // Fast tier: fall back immediately (a 503 already costs ~8 s; middle school targets < 15 s).
  const maxRetries = options.tier === "strong" ? 2 : 0;
  let retriedModels = 0;
  let lastError = "Gemini request failed.";

  for (const model of models) {
    if ((cooldownUntil.get(model) ?? 0) > Date.now()) {
      calls.push({ model, status: 0, ms: 0, promptTokens: 0, outputTokens: 0, costUsd: 0, note: "cooldown" });
      continue;
    }
    const retries = retriedModels < 2 ? maxRetries : 0;
    let usedRetry = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const left = options.deadlineMs - (Date.now() - started);
      if (left < 1500) throw new GeminiError(`Gemini deadline reached. Last: ${lastError}`, calls);
      try {
        const { status, body, ms } = await callOnce(model, key, options, Math.min(options.callTimeoutMs, left));
        if (status !== 200) {
          const kind = classify(status, body);
          calls.push({ model, status, ms, promptTokens: 0, outputTokens: 0, costUsd: 0, note: kind });
          lastError = `Gemini ${model} ${status}`;
          if (kind === "skip") {
            if (status === 429 || status === 404) cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
            break;
          }
          if (attempt < retries) {
            usedRetry = true;
            await sleep(Math.min(retryDelayMs(body, attempt), Math.max(0, left - 2000)));
          }
          continue;
        }
        const json = JSON.parse(body) as GeminiResponse;
        const usage = {
          promptTokens: json.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: (json.usageMetadata?.candidatesTokenCount ?? 0) + (json.usageMetadata?.thoughtsTokenCount ?? 0),
        };
        const finish = json.candidates?.[0]?.finishReason ?? "";
        calls.push({ model, status, ms, ...usage, costUsd: costUsd(model, usage), note: finish || undefined });
        const text = responseText(json);
        if (!text.trim() || finish === "MAX_TOKENS") {
          lastError = `Gemini ${model} ${finish || "empty"}`;
          break;
        }
        return { text, model, calls };
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        calls.push({ model, status: aborted ? 408 : 0, ms: 0, promptTokens: 0, outputTokens: 0, costUsd: 0, note: aborted ? "timeout" : "network" });
        lastError = `Gemini ${model} ${aborted ? "timeout" : "network error"}`;
        break;
      }
    }
    if (usedRetry) retriedModels += 1;
  }
  throw new GeminiError(lastError, calls);
}
