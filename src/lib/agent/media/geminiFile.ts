/**
 * Gemini multimodal call with an inline file (image / PDF / text) → text answer.
 * Inline data is fine up to ~20MB, which matches the inbound WhatsApp cap.
 */
import { geminiApiKey, geminiModels } from "@/lib/solver/llm";
import { baseMime, isPlainTextMime } from "@/lib/whatsapp/media/policy";

const GEMINI_TIMEOUT_MS = 55_000;

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export type GeminiFileResult = { ok: true; text: string; model: string } | { ok: false; error: string };

export async function geminiReadFile(input: {
  prompt: string;
  bytes: Buffer;
  mimeType: string;
  temperature?: number;
}): Promise<GeminiFileResult> {
  const key = geminiApiKey();
  if (!key) return { ok: false, error: "GEMINI_API_KEY is not set" };

  const mime = baseMime(input.mimeType);
  const filePart: GeminiPart = isPlainTextMime(mime)
    ? { text: `--- FILE CONTENT ---\n${input.bytes.toString("utf8").slice(0, 200_000)}` }
    : { inline_data: { mime_type: mime, data: input.bytes.toString("base64") } };
  const parts: GeminiPart[] = [{ text: input.prompt }, filePart];

  let lastError = "Gemini request failed";
  for (const model of geminiModels()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: input.temperature ?? 0.2 },
        }),
      });
      if (!res.ok) {
        lastError = `Gemini ${model} ${res.status}`;
        continue;
      }
      const json = (await res.json()) as GeminiResponse;
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n").trim() ?? "";
      if (text) return { ok: true, text, model };
      lastError = `Gemini ${model} returned empty text`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  return { ok: false, error: lastError };
}
