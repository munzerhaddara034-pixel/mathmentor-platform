import { openaiSolverKey, geminiApiKey } from "@/lib/solver/llm";
import { geminiModels } from "@/lib/solver/gemini/models";
import { geminiTranscribeAudio } from "@/lib/whatsapp/agentCore";
import { DEMO_DICTATION_AR, DEMO_DICTATION_EN, demoTranscriptFromStub } from "./demo";
import type { VoiceTranscript, WhisperSegment } from "./types";
import type { LessonLanguage } from "@/lib/studio/timeline";
import {
  AGENT_STT_FAILED_NOTICE_AR,
  AGENT_STT_FAILED_NOTICE_EN,
  bilingualWhisperNotice,
  politeWhisperFallbackNotice,
} from "./whisperNotices";

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

/** Shared fast-tier list (no retired ids: gemini-2.5-flash / 2.0-flash / 1.5-flash now 404). */
export function geminiSttModels(): string[] {
  const pinned = process.env.GEMINI_VOICE_MODEL?.trim();
  return pinned ? [pinned, ...geminiModels().filter((model) => model !== pinned)] : geminiModels();
}

/** Gemini multimodal STT fallback when OpenAI Whisper is unavailable (WhatsApp voice notes: ogg/opus). */
export async function transcribeWithGeminiAudio(input: {
  bytes: Buffer;
  mimeType?: string;
  language?: LessonLanguage;
}): Promise<VoiceTranscript> {
  const key = geminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const result = await geminiTranscribeAudio({
    key,
    models: geminiSttModels(),
    bytes: input.bytes,
    mimeType: input.mimeType,
    fetchImpl: fetch,
  });
  if (!result.ok) throw new Error(result.quota ? `Gemini STT quota exhausted (429): ${result.error}` : result.error);
  return {
    text: result.text,
    language: input.language,
    segments: [],
    source: "whisper", // real STT; treat as whisper-equivalent for pipeline
    warning: `Transcribed via Gemini (${result.model}).`,
  };
}

function withPoliteDemoWarning(
  transcript: VoiceTranscript,
  technical?: string,
): VoiceTranscript {
  const notice = politeWhisperFallbackNotice(technical);
  return {
    ...transcript,
    source: "demo",
    warning: bilingualWhisperNotice(notice.warning, notice.warningAr),
    warningAr: notice.warningAr,
  };
}

function emptyAgentSttFailure(technical?: string): VoiceTranscript {
  const tech = technical ? ` ${technical.slice(0, 160)}` : "";
  return {
    text: "",
    language: "ar",
    durationSec: undefined,
    segments: [],
    source: "demo",
    warning: bilingualWhisperNotice(
      AGENT_STT_FAILED_NOTICE_EN + tech,
      AGENT_STT_FAILED_NOTICE_AR,
    ),
    warningAr: AGENT_STT_FAILED_NOTICE_AR,
  };
}

/** True when text is one of the Voice Math studio practice dictations (never a real WA transcript). */
export function isPracticeDemoDictation(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  return (
    t === DEMO_DICTATION_AR ||
    t === DEMO_DICTATION_EN ||
    t.startsWith("ادرس الدالة إف إكس تساوي إكس مربع ناقص خمسة") ||
    t.startsWith("Study the function f of x equals x squared minus five")
  );
}

export async function transcribeAudioOrDemo(input: {
  bytes?: Buffer;
  filename?: string;
  mimeType?: string;
  language?: LessonLanguage;
  transcript?: string;
  durationSec?: number;
  demo?: boolean;
  /**
   * Voice Math studio may invent a practice dictation when Whisper fails.
   * WhatsApp agent MUST set this false — never reply as if the instructor asked for f(x)=x²−5x+6.
   */
  allowPracticeDictation?: boolean;
}): Promise<VoiceTranscript> {
  const allowPractice = input.allowPracticeDictation !== false;

  if (input.transcript?.trim() && (input.demo || !input.bytes)) {
    const typed: VoiceTranscript = {
      text: input.transcript.trim(),
      language: input.language,
      durationSec: input.durationSec,
      segments: [],
      source: input.demo ? "demo" : "typed",
    };
    if (!input.bytes || input.demo) {
      const stub = demoTranscriptFromStub({
        transcript: typed.text,
        language: input.language,
        durationSec: input.durationSec,
      });
      return {
        ...stub,
        source: input.demo ? "demo" : "typed",
        warning: input.demo
          ? bilingualWhisperNotice(
              "Demo transcript selected — Whisper was not called. Practice dictation for Prof. Munzer Haddara.",
              "تم اختيار النص التجريبي — لم يُستدعَ Whisper. إملاء تدريبي للأستاذ منذر حداره.",
            )
          : undefined,
        warningAr: input.demo
          ? "تم اختيار النص التجريبي — لم يُستدعَ Whisper. إملاء تدريبي للأستاذ منذر حداره."
          : undefined,
      };
    }
  }

  if (input.bytes && !input.demo) {
    // 1) Whisper
    if (hasWhisperKey()) {
      try {
        return await transcribeWithWhisper({
          bytes: input.bytes,
          filename: input.filename,
          mimeType: input.mimeType,
          language: input.language,
        });
      } catch (error) {
        const technical = error instanceof Error ? error.message : "error";
        // 2) Gemini audio fallback (WhatsApp + studio)
        if (geminiApiKey()) {
          try {
            return await transcribeWithGeminiAudio({
              bytes: input.bytes,
              mimeType: input.mimeType,
              language: input.language,
            });
          } catch (geminiError) {
            const gTech =
              geminiError instanceof Error ? geminiError.message : "gemini failed";
            if (!allowPractice) {
              return emptyAgentSttFailure(`${technical} | ${gTech}`);
            }
            const fallback = demoTranscriptFromStub({
              transcript: input.transcript,
              language: input.language,
              durationSec: input.durationSec,
            });
            return withPoliteDemoWarning(fallback, `${technical} | ${gTech}`);
          }
        }
        if (!allowPractice) {
          return emptyAgentSttFailure(technical);
        }
        const fallback = demoTranscriptFromStub({
          transcript: input.transcript,
          language: input.language,
          durationSec: input.durationSec,
        });
        return withPoliteDemoWarning(fallback, technical);
      }
    }

    // No Whisper key — try Gemini directly
    if (geminiApiKey()) {
      try {
        return await transcribeWithGeminiAudio({
          bytes: input.bytes,
          mimeType: input.mimeType,
          language: input.language,
        });
      } catch (geminiError) {
        const gTech = geminiError instanceof Error ? geminiError.message : "gemini failed";
        if (!allowPractice) return emptyAgentSttFailure(gTech);
        const stub = demoTranscriptFromStub({
          transcript: input.transcript,
          language: input.language,
          durationSec: input.durationSec,
        });
        return withPoliteDemoWarning(stub, gTech);
      }
    }

    if (!allowPractice) {
      return emptyAgentSttFailure("OPENAI_API_KEY and GEMINI_API_KEY unavailable.");
    }
  }

  const stub = demoTranscriptFromStub({
    transcript: input.transcript,
    language: input.language,
    durationSec: input.durationSec,
  });
  if (!allowPractice) {
    return emptyAgentSttFailure(
      hasWhisperKey() ? "no audio bytes" : "OPENAI_API_KEY is not set.",
    );
  }
  if (!hasWhisperKey()) {
    return withPoliteDemoWarning(stub, "OPENAI_API_KEY is not set.");
  }
  return withPoliteDemoWarning(stub);
}
