/**
 * Minimal Gemini REST client for the team agents (text + inline images/PDF, optional JSON mode).
 * Test code may inject a fake via setTeamLlmOverride(); production always calls Gemini.
 */
import { geminiApiKey } from "@/lib/solver/llm";

export type LlmPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type LlmTurn = { role: "user" | "model"; parts: LlmPart[] };

export type LlmRequest = {
  agent: string;
  system: string;
  turns: LlmTurn[];
  json?: boolean;
  temperature?: number;
};

export type LlmCall = (request: LlmRequest) => Promise<string>;

const globalForLlm = globalThis as unknown as { mmTeamLlmOverride?: LlmCall | null };

/** Test hook only (scripts/test-team-chat.ts). Never set by application code. */
export function setTeamLlmOverride(fn: LlmCall | null) {
  globalForLlm.mmTeamLlmOverride = fn;
}

export class TeamLlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamLlmUnavailableError";
  }
}

export function teamModels(): string[] {
  const pinned = process.env.TEAM_GEMINI_MODEL?.trim();
  // Several models so free-tier per-model RPM limits (429) and 503 spikes fall through to the next one.
  const defaults = [
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-flash-lite-latest",
  ];
  return pinned ? [pinned, ...defaults.filter((model) => model !== pinned)] : defaults;
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
};

function toGeminiPart(part: LlmPart) {
  if ("text" in part) return { text: part.text };
  return { inline_data: { mime_type: part.inlineData.mimeType, data: part.inlineData.data } };
}

export async function callTeamLlm(request: LlmRequest): Promise<string> {
  const override = globalForLlm.mmTeamLlmOverride;
  if (override) return override(request);
  const key = geminiApiKey();
  if (!key) throw new TeamLlmUnavailableError("GEMINI_API_KEY is not set.");

  let lastError = "Gemini request failed.";
  for (const model of teamModels()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: request.turns.map((turn) => ({ role: turn.role, parts: turn.parts.map(toGeminiPart) })),
          generationConfig: {
            temperature: request.temperature ?? 0.4,
            ...(request.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        lastError = `Gemini ${model} ${response.status}: ${(await response.text()).slice(0, 200)}`;
        continue;
      }
      const json = (await response.json()) as GeminiResponse;
      const text =
        json.candidates?.[0]?.content?.parts
          ?.filter((part) => !part.thought)
          .map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";
      if (!text) {
        lastError = `Gemini ${model} returned no text (${json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? "empty"}).`;
        continue;
      }
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

/** Parses the first JSON object in an LLM answer (tolerates ```json fences). */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function stringField(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}
