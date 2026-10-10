/**
 * يوسف image generation. Uses a real image API only when a key exists:
 *  - SAMI_IMAGE_PROVIDER=openai + OPENAI_API_KEY → OpenAI Images (gpt-image-1)
 *  - otherwise GEMINI_API_KEY → Gemini image model (SAMI_IMAGE_MODEL, default gemini-3.1-flash-image → gemini-3-pro-image; gemini-2.5-flash-image shut down 2026-10-02)
 *  - SAMI_IMAGE_GEN=off or no key → prompt only (the chat shows the prompt + a clear description).
 */
import { geminiApiKey, openaiSolverKey } from "@/lib/solver/llm";
import { redactSecrets } from "./secrets";

type ImageProvider = "openai" | "gemini";
export type ImageFailureReason = "quota" | "provider";

export type ImageGenerationResult =
  | { ok: true; image: GeneratedImage }
  | { ok: false; reason: ImageFailureReason; message?: string };

class ImageProviderFailure extends Error {
  readonly reason: ImageFailureReason;

  constructor(reason: ImageFailureReason, message: string) {
    super(message);
    this.reason = reason;
    this.name = "ImageProviderFailure";
  }
}

const imageCooldownUntil = new Map<ImageProvider, number>();
const DEFAULT_IMAGE_COOLDOWN_MINUTES = 10;

function imageCooldownMs(): number {
  const minutes = Number(process.env.SAMI_IMAGE_COOLDOWN_MINUTES ?? DEFAULT_IMAGE_COOLDOWN_MINUTES);
  return (Number.isFinite(minutes) ? Math.max(0, minutes) : DEFAULT_IMAGE_COOLDOWN_MINUTES) * 60_000;
}

function imageProviderCoolingDown(provider: ImageProvider): boolean {
  const until = imageCooldownUntil.get(provider) ?? 0;
  if (until > Date.now()) return true;
  imageCooldownUntil.delete(provider);
  return false;
}

function markImageProviderUnavailable(provider: ImageProvider): void {
  imageCooldownUntil.set(provider, Date.now() + imageCooldownMs());
}

function quotaMessage(message: string): boolean {
  return /(exceeded your current quota|quota|billing|RESOURCE_EXHAUSTED)/i.test(message);
}

function isQuotaFailure(status: number | undefined, message: string): boolean {
  return status === 429 || (status === 403 && /(quota|billing)/i.test(message)) || quotaMessage(message);
}

function safeProviderMessage(message: string): string {
  return redactSecrets(message).text
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [سرّ محجوب]")
    .replace(/\b(?:token|api[-_]?key|secret|password)\s*[:=]\s*[^\s,}"']+/gi, (match) => {
      const separator = match.search(/[:=]/);
      return `${match.slice(0, separator + 1)} [سرّ محجوب]`;
    })
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  return signal ?? AbortSignal.timeout(120_000);
}

/** Short, readable provider error ("You exceeded your current quota…") instead of raw JSON. */
function apiErrorMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    const error = parsed && typeof parsed === "object" ? (parsed as { error?: { message?: unknown } }).error : undefined;
    if (typeof error?.message === "string") return error.message.split("\n")[0].slice(0, 120);
  } catch {
    // not JSON — fall through
  }
  return body.replace(/\s+/g, " ").slice(0, 120);
}

export type GeneratedImage = { bytes: Buffer; mimeType: string; provider: string };

export function imageProviderAvailable(): ImageProvider | null {
  if (process.env.SAMI_IMAGE_GEN === "off") return null;
  if (process.env.SAMI_IMAGE_PROVIDER === "openai" && openaiSolverKey()) return "openai";
  if (geminiApiKey()) return "gemini";
  if (openaiSolverKey()) return "openai";
  return null;
}

function imageModels(): string[] {
  const pinned = process.env.SAMI_IMAGE_MODEL?.trim();
  return pinned ? [pinned] : ["gemini-3.1-flash-image", "gemini-3-pro-image"];
}

async function viaGemini(prompt: string, signal?: AbortSignal): Promise<GeneratedImage> {
  let lastError = "Gemini image generation failed.";
  for (const model of imageModels()) {
    try {
      return await viaGeminiModel(model, prompt, signal);
    } catch (error) {
      if (error instanceof ImageProviderFailure && error.reason === "quota") throw error;
      if (error instanceof Error && quotaMessage(error.message)) {
        throw new ImageProviderFailure("quota", safeProviderMessage(error.message));
      }
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new ImageProviderFailure("provider", safeProviderMessage(lastError));
}

async function viaGeminiModel(model: string, prompt: string, signal?: AbortSignal): Promise<GeneratedImage> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey() },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
    signal: requestSignal(signal),
  });
  if (!response.ok) {
    const message = apiErrorMessage(await response.text());
    const detail = `Gemini image ${response.status}: ${message}`;
    throw new ImageProviderFailure(isQuotaFailure(response.status, message) ? "quota" : "provider", safeProviderMessage(detail));
  }
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
  };
  const part = json.candidates?.[0]?.content?.parts?.find((item) => item.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("Gemini image model returned no image.");
  return {
    bytes: Buffer.from(part.inlineData.data, "base64"),
    mimeType: part.inlineData.mimeType || "image/png",
    provider: `gemini:${model}`,
  };
}

async function viaOpenAi(prompt: string, signal?: AbortSignal): Promise<GeneratedImage> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiSolverKey()}` },
    body: JSON.stringify({ model: process.env.SAMI_OPENAI_IMAGE_MODEL || "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
    signal: requestSignal(signal),
  });
  if (!response.ok) {
    const message = apiErrorMessage(await response.text());
    const detail = `OpenAI image ${response.status}: ${message}`;
    throw new ImageProviderFailure(isQuotaFailure(response.status, message) ? "quota" : "provider", safeProviderMessage(detail));
  }
  const json = (await response.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image.");
  return { bytes: Buffer.from(b64, "base64"), mimeType: "image/png", provider: "openai:gpt-image-1" };
}

export async function generateImage(prompt: string, options: { signal?: AbortSignal } = {}): Promise<ImageGenerationResult> {
  const provider = imageProviderAvailable();
  if (!provider) return { ok: false, reason: "provider", message: "No image-generation key configured." };
  // A quota block is process-local: subsequent turns avoid another doomed provider request until the TTL expires.
  if (imageProviderCoolingDown(provider)) return { ok: false, reason: "quota" };
  try {
    const image = provider === "openai" ? await viaOpenAi(prompt, options.signal) : await viaGemini(prompt, options.signal);
    return { ok: true, image };
  } catch (error) {
    const failure = error instanceof ImageProviderFailure
      ? error
      : new ImageProviderFailure("provider", safeProviderMessage(error instanceof Error ? error.message : "Image provider failed."));
    if (failure.reason === "quota") markImageProviderUnavailable(provider);
    return { ok: false, reason: failure.reason, message: failure.message };
  }
}

/** Test-only reset; no production code calls this and it does not affect provider configuration. */
export function resetImageProviderCooldownForTests(): void {
  imageCooldownUntil.clear();
}
