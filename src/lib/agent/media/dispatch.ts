/**
 * Route-level dispatch for WhatsApp media + "mock exam" file replies.
 * Webhooks ACK immediately and work in `after()` (Meta retries slow webhooks);
 * staff / Agent Hub calls run synchronously and return the full result.
 */
import { after } from "next/server";
import { buildMockExamPdf } from "./mockExamPdf";
import { handleInboundMedia, type InboundMediaMessage, type InboundMediaResult } from "./handleInbound";
import { replyToMediaMessage, sendMediaAck, type MediaReplyResult } from "./reply";
import { mediaErrorReplyAr } from "@/lib/whatsapp/media/errorsAr";

const SEEN_TTL_MS = 60 * 60 * 1000;
const seenMessageIds = new Map<string, number>();

/** True when this provider message id was already accepted recently (Meta webhook retries). */
export function isDuplicateMessage(messageId: string | undefined): boolean {
  if (!messageId) return false;
  const now = Date.now();
  for (const [id, at] of seenMessageIds) if (now - at > SEEN_TTL_MS) seenMessageIds.delete(id);
  if (seenMessageIds.has(messageId)) return true;
  seenMessageIds.set(messageId, now);
  return false;
}

/** Run after the webhook response (Meta retries slow webhooks). Errors are logged, never thrown. */
export function runLater(label: string, task: () => Promise<unknown>): void {
  const wrapped = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[mathmentor] ${label} background task failed:`, error instanceof Error ? error.message : error);
    }
  };
  try {
    after(wrapped);
  } catch {
    // Outside a request scope (tests / scripts): plain fire-and-forget.
    void wrapped();
  }
}

export type MediaDispatchResponse =
  | { mode: "background"; accepted: true; duplicate?: boolean }
  | { mode: "sync"; result: InboundMediaResult };

export async function dispatchInboundMedia(msg: InboundMediaMessage, background: boolean): Promise<MediaDispatchResponse> {
  if (background) {
    if (isDuplicateMessage(msg.messageId)) return { mode: "background", accepted: true, duplicate: true };
    runLater("whatsapp media", () => handleInboundMedia({ ...msg, sendAck: true }));
    return { mode: "background", accepted: true };
  }
  return { mode: "sync", result: await handleInboundMedia(msg) };
}

export type MockExamResult = { ok: boolean; reply?: MediaReplyResult; error?: string };

export async function sendMockExam(input: { to: string; track?: string; messageId?: string }): Promise<MockExamResult> {
  try {
    const exam = await buildMockExamPdf({ track: input.track });
    const reply = await replyToMediaMessage({
      to: input.to,
      replyAr: `${exam.captionAr}\n📄 الملف مرفق.`,
      status: "completed",
      note: "whatsapp_mock_exam_pdf",
      filename: exam.filename,
      mimeType: "application/pdf",
      sizeBytes: exam.bytes.length,
      parameters: { paperId: exam.paperId, setId: exam.setId, questionCount: exam.questionCount, source: exam.source },
      attachment: { bytes: exam.bytes, filename: exam.filename, caption: exam.captionAr },
      replyToMessageId: input.messageId,
    });
    return { ok: reply.attachment?.status === "sent" || reply.attachment?.status === "logged", reply };
  } catch (error) {
    const message = error instanceof Error ? error.message : "mock exam failed";
    try {
      const reply = await replyToMediaMessage({
        to: input.to,
        replyAr: mediaErrorReplyAr("processing_failed", { kindAr: "الامتحان التجريبي" }),
        status: "failed",
        note: "whatsapp_mock_exam_failed",
      });
      return { ok: false, reply, error: message };
    } catch {
      return { ok: false, error: message };
    }
  }
}

export async function dispatchMockExam(
  input: { to: string; track?: string; messageId?: string },
  background: boolean,
): Promise<{ mode: "background"; accepted: true; duplicate?: boolean } | { mode: "sync"; result: MockExamResult }> {
  if (background) {
    if (isDuplicateMessage(input.messageId)) return { mode: "background", accepted: true, duplicate: true };
    runLater("mock exam", async () => {
      await sendMediaAck(input.to, "⏳ عم حضّرلك امتحان تجريبي كملف PDF… لحظات.");
      await sendMockExam(input);
    });
    return { mode: "background", accepted: true };
  }
  return { mode: "sync", result: await sendMockExam(input) };
}
