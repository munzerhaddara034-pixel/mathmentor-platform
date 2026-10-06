/** Provider calls with token usage: Gemini generateContent and OpenAI Responses API (fetch, no SDK). */
import type { ModelSpec } from "../config";
import type { TokenUsage } from "./pricing";

export type RouterTurn = { role: "user" | "model"; text: string };
export type RouterRequest = { step: string; system: string; turns: RouterTurn[]; json: boolean; temperature?: number; timeoutMs?: number };
export type ProviderResult = { text: string; usage: TokenUsage };
export type Transport = (spec: ModelSpec, request: RouterRequest) => Promise<ProviderResult>;

export class ProviderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

type GeminiBody = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; cachedContentTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

async function gemini(spec: ModelSpec, request: RouterRequest, key: string): Promise<ProviderResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(spec.model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
      generationConfig: { temperature: request.temperature ?? 0.2, ...(request.json ? { responseMimeType: "application/json" } : {}) },
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? 180_000),
  });
  if (!response.ok) throw new ProviderError(`${spec.id} ${response.status}: ${(await response.text()).slice(0, 200)}`, response.status);
  const body = (await response.json()) as GeminiBody;
  const text = body.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("").trim() ?? "";
  const meta = body.usageMetadata ?? {};
  return {
    text,
    usage: {
      inputTokens: meta.promptTokenCount ?? 0,
      cachedTokens: meta.cachedContentTokenCount ?? 0,
      // Thinking tokens are billed as output.
      outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
    },
  };
}

type OpenAiBody = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
};

async function openai(spec: ModelSpec, request: RouterRequest, key: string): Promise<ProviderResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: spec.model,
      instructions: request.system,
      input: request.turns.map((turn) => ({ role: turn.role === "model" ? "assistant" : "user", content: turn.text })),
      ...(request.json ? { text: { format: { type: "json_object" } } } : {}),
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? 180_000),
  });
  if (!response.ok) throw new ProviderError(`${spec.id} ${response.status}: ${(await response.text()).slice(0, 200)}`, response.status);
  const body = (await response.json()) as OpenAiBody;
  const text =
    body.output_text ??
    (body.output ?? [])
      .flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  return {
    text: text.trim(),
    usage: {
      inputTokens: body.usage?.input_tokens ?? 0,
      cachedTokens: body.usage?.input_tokens_details?.cached_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
    },
  };
}

/** Real network transport. Keys from env only; never logged, never sent to the model. */
export const httpTransport: Transport = async (spec, request) => {
  if (spec.provider === "openai") {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new ProviderError("OPENAI_API_KEY is not set.", 401);
    return openai(spec, request, key);
  }
  const key = (process.env.HAMZA_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!key) throw new ProviderError("GEMINI_API_KEY is not set.", 401);
  return gemini(spec, request, key);
};
