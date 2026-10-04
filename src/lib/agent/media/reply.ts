/**
 * Reply to a WhatsApp media message: Arabic text via the agent sender (persists an
 * Agent Hub task) and optional file attachments via sendWhatsAppMedia.
 */
import { createId } from "@/lib/ids";
import { sendAgentWhatsAppConfirmation, type AgentOutboundStatus } from "@/lib/agent/whatsappSender";
import type { WhatsAppVoiceTask } from "@/lib/agent/types";
import { sendWhatsApp } from "@/lib/whatsapp/adapter";
import { sendWhatsAppMedia, type SendMediaResult } from "@/lib/whatsapp/media/send";
import { PDF_BUILD_FAILED_AR, PDF_SEND_FAILED_AR, withNoteBeforeSignature } from "@/lib/whatsapp/agentCore";

export type MediaReplyInput = {
  to: string;
  replyAr: string;
  status: WhatsAppVoiceTask["status"];
  note: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  parameters?: Record<string, string | number | boolean | null>;
  relatedIds?: string[];
  attachment?: { bytes: Buffer; filename: string; caption: string; mimeType?: string };
  /** A PDF was due but could not be generated → tell the student (text still goes out). */
  pdfError?: string;
  /** Status line added above the signature once the attachment is delivered. */
  attachmentSentNoteAr?: string;
  replyToMessageId?: string;
};

/** Delivered (or, without a configured provider, logged to the outbox). */
export function attachmentDelivered(result: SendMediaResult | undefined): boolean {
  return Boolean(result && (result.status === "sent" || result.status === "logged"));
}

/** The student-facing status line for the attachment (empty when there is nothing to say). */
export function attachmentStatusNoteAr(input: {
  hadAttachment: boolean;
  result?: SendMediaResult;
  pdfError?: string;
  sentNoteAr?: string;
}): string {
  if (input.hadAttachment) {
    if (attachmentDelivered(input.result)) return input.sentNoteAr || "";
    return PDF_SEND_FAILED_AR;
  }
  return input.pdfError ? PDF_BUILD_FAILED_AR : "";
}

export type MediaReplyResult = {
  task: WhatsAppVoiceTask;
  outbound: AgentOutboundStatus;
  attachment?: SendMediaResult;
};

/** Short "working on it" text before slow Gemini work. Never throws. */
export async function sendMediaAck(to: string, textAr: string): Promise<void> {
  try {
    await sendWhatsApp({ to, kind: "agent_ops", body: textAr });
  } catch {
    /* ack is best-effort */
  }
}

export async function replyToMediaMessage(input: MediaReplyInput): Promise<MediaReplyResult> {
  const now = new Date().toISOString();
  const taskId = createId("wamtask");
  let attachment: SendMediaResult | undefined;
  if (input.attachment) {
    const masked = `…${input.to.replace(/\D/g, "").slice(-4)}`;
    try {
      attachment = await sendWhatsAppMedia(
        input.to,
        {
          type: "document",
          bytes: input.attachment.bytes,
          mimeType: input.attachment.mimeType || "application/pdf",
          filename: input.attachment.filename,
          caption: input.attachment.caption,
          replyToMessageId: input.replyToMessageId,
        },
        { relatedId: taskId },
      );
    } catch (error) {
      // sendWhatsAppMedia never throws by contract; keep the text reply alive regardless.
      attachment = {
        status: "failed",
        provider: "unknown",
        to: input.to,
        error: error instanceof Error ? error.message : "media send threw",
        failureStage: "provider",
        at: now,
      };
    }
    if (attachmentDelivered(attachment)) {
      console.info(
        `[whatsapp-agent] document ${attachment.status} via ${attachment.provider} to ${masked}: ${input.attachment.filename} ` +
          `(${input.attachment.bytes.length} bytes${attachment.mediaId ? `, media ${attachment.mediaId}` : ""}${attachment.messageId ? `, msg ${attachment.messageId}` : ""})`,
      );
    } else {
      console.error(
        `[whatsapp-agent] document send FAILED (${attachment.status}${attachment.failureStage ? `/${attachment.failureStage}` : ""}) via ${attachment.provider} ` +
          `to ${masked}: ${input.attachment.filename} — ${(attachment.error || "unknown error").slice(0, 300)}`,
      );
    }
  } else if (input.pdfError) {
    console.error(`[whatsapp-agent] no PDF attached (generation failed): ${input.pdfError.slice(0, 200)}`);
  }
  const attachmentNote = attachmentStatusNoteAr({
    hadAttachment: Boolean(input.attachment),
    result: attachment,
    pdfError: input.pdfError,
    sentNoteAr: input.attachmentSentNoteAr,
  });
  const replyText = withNoteBeforeSignature(input.replyAr, attachmentNote);

  const task: WhatsAppVoiceTask = {
    id: taskId,
    audioLog: {
      filename: input.filename,
      mimeType: input.mimeType,
      bytesLength: input.sizeBytes,
      receivedAt: now,
      senderPhone: input.to,
    },
    whisperTranscript: input.caption || `[${input.note}] ${input.filename ?? ""}`.trim(),
    transcriptSource: "typed",
    intent: {
      kind: "general_task",
      confidence: 1,
      parameters: {
        note: input.note,
        channel: "whatsapp_media",
        ...(input.parameters ?? {}),
        attachmentStatus: attachment?.status ?? (input.pdfError ? "pdf_build_failed" : null),
        ...(attachment?.error ? { attachmentError: attachment.error.slice(0, 300) } : {}),
      },
      source: "heuristic",
    },
    status: input.status,
    automatedReplyText: replyText,
    relatedIds: [...(input.relatedIds ?? []), ...(attachment?.recordId ? [attachment.recordId] : [])],
    createdAt: now,
    updatedAt: now,
  };
  const { outbound, task: saved } = await sendAgentWhatsAppConfirmation({ to: input.to, task });
  return { task: saved, outbound, attachment };
}
