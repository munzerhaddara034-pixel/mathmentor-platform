/**
 * Inbound WhatsApp media (image / document / video; sticker ignored) for محمد:
 * download (size + MIME checks) → store under data/ → act per caption → reply.
 * Audio stays on the existing voice pipeline. Never throws.
 */
import { downloadMediaUrl, downloadMetaMedia, type MediaDownloadResult } from "@/lib/whatsapp/media/download";
import { mediaErrorReplyAr, mediaKindAr, MEDIA_SIGNATURE_AR } from "@/lib/whatsapp/media/errorsAr";
import {
  checkInboundMedia,
  formatMegabytes,
  formatSizeAr,
  INBOUND_MAX_BYTES,
  isGeminiReadableMime,
  type InboundMediaKind,
} from "@/lib/whatsapp/media/policy";
import { patchMediaRecord, saveMediaRecord, type WhatsAppMediaRecord } from "@/lib/whatsapp/media/store";
import { PDF_SENT_AR } from "@/lib/whatsapp/agentCore";
import {
  solveFileAction,
  summarizeFileAction,
  verifyExamFileAction,
  type ActionOutcome,
  type FileForAction,
} from "./actions";
import { detectMediaAction, shouldSendPdfForInboundFile, type MediaAction } from "./captionIntent";
import { rememberLastPdf } from "./lastPdf";
import { replyToMediaMessage, sendMediaAck, type MediaReplyResult } from "./reply";

export type InboundMediaMessage = {
  provider: string;
  from: string;
  kind: InboundMediaKind;
  mediaId?: string;
  mediaUrl?: string;
  bytes?: Buffer;
  mimeType?: string;
  filename?: string;
  caption?: string;
  messageId?: string;
  /** Send a short "working on it" text before slow actions (webhook/background mode). */
  sendAck?: boolean;
};

export type InboundMediaResult = {
  ok: boolean;
  ignored?: string;
  action?: MediaAction;
  record?: WhatsAppMediaRecord;
  reply?: MediaReplyResult;
  error?: string;
};

const ACK_AR: Record<Exclude<MediaAction, "store">, string> = {
  solve: "⏳ وصلتني المسألة، عم حلّها وإتحقّق منها… دقيقة وبرجعلك.",
  summarize: "⏳ وصلني الملف، عم إقراه وإلخّصو… دقيقة وبرجعلك.",
  verify_exam: "⏳ وصلني الامتحان، عم دقّقو سؤال سؤال… دقيقة وبرجعلك.",
};

/** Meta sends no filename for images / videos: name them by kind + UTC timestamp. */
function defaultFilename(msg: InboundMediaMessage): string {
  if (msg.filename?.trim()) return msg.filename;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
  return `whatsapp-${msg.kind}-${stamp}`;
}

async function obtainBytes(msg: InboundMediaMessage): Promise<MediaDownloadResult> {
  if (msg.bytes) {
    const check = checkInboundMedia({ mimeType: msg.mimeType, sizeBytes: msg.bytes.length });
    if (!check.ok) {
      return {
        ok: false,
        reason: check.reason,
        error: `media rejected: ${check.reason}`,
        mimeType: check.mimeType,
        sizeBytes: msg.bytes.length,
        limitBytes: check.limitBytes,
      };
    }
    return { ok: true, bytes: msg.bytes, mimeType: check.mimeType, category: check.category, sizeBytes: msg.bytes.length };
  }
  if (msg.mediaId) return downloadMetaMedia(msg.mediaId, { mimeHint: msg.mimeType });
  if (msg.mediaUrl) return downloadMediaUrl(msg.mediaUrl, { mimeHint: msg.mimeType });
  return { ok: false, reason: "download_failed", error: "no media id, url or bytes" };
}

function storedReplyAr(record: WhatsAppMediaRecord, kindAr: string): string {
  return [
    `📁 حفظت ${kindAr} بملفاتك ✅`,
    `• الاسم: ${record.filename}`,
    `• الحجم: ${formatSizeAr(record.sizeBytes)}`,
    "بتلاقيه بـ Agent Hub ← ملفات واتساب.",
    MEDIA_SIGNATURE_AR,
  ].join("\n");
}

async function runAction(action: MediaAction, file: FileForAction, from: string, caption?: string): Promise<ActionOutcome> {
  try {
    if (action === "solve") return await solveFileAction(file, from, shouldSendPdfForInboundFile());
    if (action === "summarize") return await summarizeFileAction(file);
    if (action === "verify_exam") return await verifyExamFileAction(file);
    return { ok: true, replyAr: "", relatedIds: [] };
  } catch (error) {
    return { ok: false, replyAr: "", relatedIds: [], note: error instanceof Error ? error.message : "action failed" };
  }
}

export async function handleInboundMedia(msg: InboundMediaMessage): Promise<InboundMediaResult> {
  if (msg.kind === "sticker") return { ok: true, ignored: "sticker" };
  if (msg.kind === "audio") return { ok: false, ignored: "audio_uses_voice_pipeline" };
  const kindAr = mediaKindAr(msg.kind);

  try {
    const downloaded = await obtainBytes(msg);
    if (!downloaded.ok) {
      const record = await saveMediaRecord({
        direction: "inbound",
        kind: msg.kind,
        mimeType: downloaded.mimeType || msg.mimeType || "",
        filename: defaultFilename(msg),
        sizeBytes: downloaded.sizeBytes,
        from: msg.from,
        caption: msg.caption,
        provider: msg.provider,
        waMediaId: msg.mediaId,
        waMessageId: msg.messageId,
        status: "rejected",
        note: downloaded.error,
      });
      const replyAr = mediaErrorReplyAr(downloaded.reason, {
        kindAr,
        mimeType: downloaded.mimeType || msg.mimeType,
        sizeMb: downloaded.sizeBytes ? formatMegabytes(downloaded.sizeBytes) : undefined,
        limitMb: formatMegabytes(downloaded.limitBytes ?? INBOUND_MAX_BYTES),
      });
      const reply = await replyToMediaMessage({
        to: msg.from,
        replyAr,
        status: "failed",
        note: `whatsapp_media_${downloaded.reason}`,
        caption: msg.caption,
        filename: record.filename,
        mimeType: record.mimeType,
        parameters: { mediaRecordId: record.id, reason: downloaded.reason },
        relatedIds: [record.id],
      });
      return { ok: false, record, reply, error: downloaded.error };
    }

    const record = await saveMediaRecord({
      direction: "inbound",
      kind: msg.kind,
      mimeType: downloaded.mimeType,
      filename: defaultFilename(msg),
      bytes: downloaded.bytes,
      from: msg.from,
      caption: msg.caption,
      provider: msg.provider,
      waMediaId: msg.mediaId,
      waMessageId: msg.messageId,
      status: "received",
    });

    const category = downloaded.category;
    const readable = isGeminiReadableMime(downloaded.mimeType);
    const action = detectMediaAction({ caption: msg.caption, category, readable });

    let outcome: ActionOutcome;
    if (action === "store") {
      const unreadableAsk = category === "document" && !readable && Boolean(msg.caption) && !/احفظ|خزن|خزّن|save|store/i.test(msg.caption ?? "");
      outcome = {
        ok: true,
        replyAr: unreadableAsk ? mediaErrorReplyAr("unreadable_document", { kindAr }) : storedReplyAr(record, kindAr),
        relatedIds: [],
      };
    } else {
      if (msg.sendAck) await sendMediaAck(msg.from, ACK_AR[action]);
      outcome = await runAction(
        action,
        {
          bytes: downloaded.bytes,
          mimeType: downloaded.mimeType,
          filename: record.filename,
          caption: msg.caption,
          recordId: record.id,
          fileUrl: `/api/agent/whatsapp-media/files/${record.id}`,
        },
        msg.from,
        msg.caption,
      );
    }

    const replyAr = outcome.replyAr || mediaErrorReplyAr("processing_failed", { kindAr });
    if (outcome.pdf) rememberLastPdf(msg.from, { ...outcome.pdf, mimeType: "application/pdf" });
    const reply = await replyToMediaMessage({
      to: msg.from,
      replyAr,
      status: outcome.ok ? "completed" : "failed",
      note: `whatsapp_media_${action}`,
      caption: msg.caption,
      filename: record.filename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      parameters: { mediaRecordId: record.id, action, mediaKind: msg.kind },
      relatedIds: [record.id, ...outcome.relatedIds],
      attachment: outcome.pdf,
      attachmentSentNoteAr: outcome.pdf ? PDF_SENT_AR : undefined,
      pdfError: outcome.pdfError,
      replyToMessageId: msg.messageId,
    });

    const patched = await patchMediaRecord(record.id, {
      status: outcome.ok ? "processed" : "failed",
      action,
      note: outcome.note,
      relatedIds: [reply.task.id, ...outcome.relatedIds],
    });
    return { ok: outcome.ok, action, record: patched ?? record, reply, error: outcome.ok ? undefined : outcome.note };
  } catch (error) {
    const message = error instanceof Error ? error.message : "media handler failed";
    try {
      const reply = await replyToMediaMessage({
        to: msg.from,
        replyAr: mediaErrorReplyAr("processing_failed", { kindAr }),
        status: "failed",
        note: "whatsapp_media_error",
        caption: msg.caption,
        filename: defaultFilename(msg),
        mimeType: msg.mimeType,
      });
      return { ok: false, reply, error: message };
    } catch {
      return { ok: false, error: message };
    }
  }
}
