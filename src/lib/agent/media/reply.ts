/**
 * Reply to a WhatsApp media message: Arabic text via the agent sender (persists an
 * Agent Hub task) and optional file attachments via sendWhatsAppMedia.
 */
import { createId } from "@/lib/ids";
import { sendAgentWhatsAppConfirmation, type AgentOutboundStatus } from "@/lib/agent/whatsappSender";
import type { WhatsAppVoiceTask } from "@/lib/agent/types";
import { sendWhatsApp } from "@/lib/whatsapp/adapter";
import { sendWhatsAppMedia, type SendMediaResult } from "@/lib/whatsapp/media/send";

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
  replyToMessageId?: string;
};

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
  }
  const attachmentNote =
    attachment && attachment.status !== "sent" && attachment.status !== "logged"
      ? "\n⚠️ ما زبط إرسال ملف الـ PDF هلّق — موجود بـ Agent Hub."
      : "";

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
        attachmentStatus: attachment?.status ?? null,
      },
      source: "heuristic",
    },
    status: input.status,
    automatedReplyText: `${input.replyAr}${attachmentNote}`,
    relatedIds: [...(input.relatedIds ?? []), ...(attachment?.recordId ? [attachment.recordId] : [])],
    createdAt: now,
    updatedAt: now,
  };
  const { outbound, task: saved } = await sendAgentWhatsAppConfirmation({ to: input.to, task });
  return { task: saved, outbound, attachment };
}
