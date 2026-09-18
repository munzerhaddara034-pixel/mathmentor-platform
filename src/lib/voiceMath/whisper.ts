import { openaiSolverKey } from "@/lib/solver/llm";
import { demoTranscriptFromStub } from "./demo";
import type { VoiceTranscript, WhisperSegment } from "./types";
import type { LessonLanguage } from "@/lib/studio/timeline";

export function whisperApiKey() {
  return openaiSolverKey();
}

export function hasWhisperKey() {
  return whisperApiKey().length > 0;
}

function asSegments(raw: unknown): WhisperSegment[] {
  if (!Array.isArray(raw)) return [];
  const out: WhisperSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const start = Number(rec.start);
    const end = Number(rec.end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    out.push({ start, end, text });
  }
  return out;
}

export async function transcribeWithWhisper(input: {
  bytes: Buffer;
  filename?: string;
  mimeType?: string;
  language?: LessonLanguage;
}): Promise<VoiceTranscript> {
  const key = whisperApiKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  const filename = input.filename || (input.mimeType?.includes("wav") ? "dictation.wav" : "dictation.webm");
  const mime = input.mimeType || (filename.endsWith(".wav") ? "audio/wav" : "audio/webm");
  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.bytes)], { type: mime });
  form.set("file", blob, filename);
  form.set("model", "whisper-1");
  form.set("response_format", "verbose_json");
  if (input.language === "ar" || input.language === "en" || input.language === "fr") {
    form.set("language", input.language === "ar" ? "ar" : input.language === "fr" ? "fr" : "en");
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Whisper ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
  const json = (await response.json()) as {
    text?: string;
    duration?: number;
    language?: string;
    segments?: unknown;
  };
  const text = json.text?.trim() || "";
  if (!text) throw new Error("Whisper returned an empty transcript.");
  const segments = asSegments(json.segments);
  const durationSec =
    typeof json.duration === "number" && json.duration > 0
      ? json.duration
      : segments.length
        ? segments[segments.length - 1].end
        : undefined;
  return {
    text,
    language: json.language || input.language,
    durationSec,
    segments,
    source: "whisper",
  };
}

export async function transcribeAudioOrDemo(input: {
  bytes?: Buffer;
  filename?: string;
  mimeType?: string;
  language?: LessonLanguage;
  transcript?: string;
  durationSec?: number;
  demo?: boolean;
}): Promise<VoiceTranscript> {
  if (input.transcript?.trim() && (input.demo || !input.bytes)) {
    const typed: VoiceTranscript = {
      text: input.transcript.trim(),
      language: input.language,
      durationSec: input.durationSec,
      segments: [],
      source: input.demo ? "demo" : "typed",
    };
    if (!input.bytes || input.demo) {
      return {
        ...demoTranscriptFromStub({
          transcript: typed.text,
          language: input.language,
          durationSec: input.durationSec,
        }),
        source: input.demo ? "demo" : "typed",
        warning: input.demo
          ? demoTranscriptFromStub().warning
          : undefined,
      };
    }
  }

  if (input.bytes && hasWhisperKey() && !input.demo) {
    try {
      return await transcribeWithWhisper({
        bytes: input.bytes,
        filename: input.filename,
        mimeType: input.mimeType,
        language: input.language,
      });
    } catch (error) {
      const fallback = demoTranscriptFromStub({
        transcript: input.transcript,
        language: input.language,
        durationSec: input.durationSec,
      });
      fallback.warning = `Whisper failed (${error instanceof Error ? error.message : "error"}); used demo dictation.`;
      return fallback;
    }
  }

  return demoTranscriptFromStub({
    transcript: input.transcript,
    language: input.language,
    durationSec: input.durationSec,
  });
}
