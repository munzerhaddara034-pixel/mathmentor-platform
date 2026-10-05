/**
 * Production wiring of the WhatsApp agent turn (محمد): typed text and voice notes from the
 * instructor → the upgraded solver (+ PDF), mock-exam PDFs, or the intent pipeline.
 * The orchestration itself lives in the dependency-free, unit-tested src/lib/whatsapp/agentCore.ts.
 */
import { buildMockExamPdf } from "./mockExamPdf";
import { solveForWhatsApp } from "./actions";
import { isDuplicateMessage, runLater } from "./dispatch";
import { recallLastPdf, rememberLastPdf } from "./lastPdf";
import { replyToMediaMessage, sendMediaAck } from "./reply";
import { geminiApiKey } from "@/lib/solver/llm";
import { geminiSttModels, hasWhisperKey, transcribeWithWhisper } from "@/lib/voiceMath/whisper";
import { downloadMediaUrl, downloadMetaMedia } from "@/lib/whatsapp/media/download";
import {
  geminiTranscribeAudio,
  isGeminiQuotaError,
  runAgentTurn,
  type AgentTurnDeps,
  type AgentTurnInput,
  type AgentTurnResult,
  type TranscribeResult,
} from "@/lib/whatsapp/agentCore";

async function transcribeVoiceNote(bytes: Buffer, mimeType: string): Promise<TranscribeResult> {
  if (hasWhisperKey()) {
    try {
      const out = await transcribeWithWhisper({ bytes, mimeType, filename: "voice-note.ogg", language: "ar" });
      if (out.text.trim()) return { ok: true, text: out.text.trim(), model: "whisper-1" };
    } catch (error) {
      console.warn("[whatsapp-agent] Whisper failed, trying Gemini:", error instanceof Error ? error.message.slice(0, 200) : error);
    }
  }
  const key = geminiApiKey();
  if (!key) return { ok: false, quota: false, error: "No speech-to-text key (OPENAI_API_KEY / GEMINI_API_KEY) is set." };
  return geminiTranscribeAudio({ key, models: geminiSttModels(), bytes, mimeType, fetchImpl: fetch });
}

export function whatsappAgentDeps(fallback: AgentTurnDeps["fallback"]): AgentTurnDeps {
  return {
    download: async ({ mediaId, mediaUrl, mimeHint }) => {
      if (mediaId) return downloadMetaMedia(mediaId, { mimeHint });
      if (mediaUrl) return downloadMediaUrl(mediaUrl, { mimeHint });
      return { ok: false, reason: "download_failed", error: "no media id or url" };
    },
    transcribe: transcribeVoiceNote,
    solve: solveForWhatsApp,
    mockExam: async (track) => {
      const exam = await buildMockExamPdf({ track });
      return { bytes: exam.bytes, filename: exam.filename, captionAr: exam.captionAr };
    },
    reply: async (reply) => {
      if (reply.attachment) rememberLastPdf(reply.to, reply.attachment);
      await replyToMediaMessage({
        to: reply.to,
        replyAr: reply.textAr,
        status: reply.status,
        note: reply.note,
        relatedIds: reply.relatedIds,
        parameters: reply.transcript ? { transcript: reply.transcript.slice(0, 500) } : undefined,
        attachment: reply.attachment,
        attachmentSentNoteAr: reply.attachmentSentNoteAr,
        pdfError: reply.pdfError,
        filename: reply.attachment?.filename,
        mimeType: reply.attachment?.mimeType,
        sizeBytes: reply.attachment?.bytes.length,
        replyToMessageId: reply.replyToMessageId,
        interactiveButtons: reply.interactiveButtons,
      });
    },
    fallback,
    lastPdf: recallLastPdf,
    ack: sendMediaAck,
    log: (level, message) => {
      if (level === "error") console.error(message);
      else if (level === "warn") console.warn(message);
      else console.info(message);
    },
  };
}

export type AgentTurnDispatch =
  | { mode: "background"; accepted: true; duplicate?: boolean }
  | { mode: "sync"; result: AgentTurnResult };

/** Webhooks: ACK now, work after the response (Meta retries slow webhooks); duplicates are dropped. */
export async function dispatchAgentTurn(
  input: AgentTurnInput,
  fallback: AgentTurnDeps["fallback"],
  background: boolean,
): Promise<AgentTurnDispatch> {
  const deps = whatsappAgentDeps(fallback);
  if (background) {
    if (isDuplicateMessage(input.messageId)) return { mode: "background", accepted: true, duplicate: true };
    runLater("whatsapp agent turn", () => runAgentTurn(input, deps));
    return { mode: "background", accepted: true };
  }
  return { mode: "sync", result: await runAgentTurn(input, deps) };
}

export { isGeminiQuotaError };
