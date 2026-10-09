/**
 * «محمد» يراسل الأستاذ منذر على واتساب من رقم المنصة — نصاً وملفاً.
 *
 * The owner's number is the platform instructor number (INSTRUCTOR_WHATSAPP_NUMBER, default 96176532421);
 * it never falls back to the Whish wallet. Sending stays a no-op with a clear Arabic notice when the
 * WhatsApp provider is not configured on the server, so the team chat never claims a message that never left.
 */
import { instructorWhatsAppNumber, sendWhatsApp, whatsappConfigured } from "@/lib/whatsapp/adapter";
import { sendWhatsAppMedia } from "@/lib/whatsapp/media/send";
import { teamRepo } from "./store";

export type OwnerWhatsAppFile = {
  /** Attachment id from the team chat (tatt_…) — the bytes are read from the team store. */
  attachmentId?: string;
  /** Public https link (Meta can fetch it; other providers need a link for media). */
  link?: string;
  filename?: string;
  mimeType?: string;
};

export type OwnerWhatsAppResult = { ok: boolean; sent: boolean; detailAr: string };

/** The platform's WhatsApp number (the owner). */
export function ownerWhatsAppNumber(): string {
  return instructorWhatsAppNumber();
}

function categoryFor(mimeType: string): "image" | "document" {
  return /^image\/(png|jpe?g|webp|gif)$/i.test(mimeType) ? "image" : "document";
}

/** Sends a text and/or one file to the owner's WhatsApp from the platform number. Never throws. */
export async function sendOwnerWhatsApp(input: { text: string; file?: OwnerWhatsAppFile }): Promise<OwnerWhatsAppResult> {
  const to = ownerWhatsAppNumber();
  const text = (input.text ?? "").trim().slice(0, 3500);
  const file = input.file;
  if (!text && !file?.attachmentId && !file?.link) {
    return { ok: false, sent: false, detailAr: "لا نص ولا ملف للإرسال." };
  }
  if (!whatsappConfigured()) {
    return {
      ok: false,
      sent: false,
      detailAr: "قناة واتساب غير مهيّأة على الخادم (لا مزوّد ولا توكن) — لم يُرسل شيء إلى واتساب.",
    };
  }
  try {
    if (file?.attachmentId || file?.link) {
      const mimeType = file.mimeType?.trim() || "application/octet-stream";
      const filename = file.filename?.trim() || "mathmentor-file";
      let bytes: Buffer | undefined;
      if (file.attachmentId) {
        const stored = await teamRepo().getAttachment(file.attachmentId);
        if (!stored) {
          return { ok: false, sent: false, detailAr: `لم أجد المرفق ${file.attachmentId} في محادثة الفريق.` };
        }
        bytes = stored.bytes;
      }
      const result = await sendWhatsAppMedia(to, {
        type: categoryFor(mimeType),
        ...(bytes ? { bytes } : { link: file.link }),
        mimeType,
        filename,
        caption: text || undefined,
      });
      const delivered = result.status === "sent" || result.status === "logged";
      return {
        ok: delivered,
        sent: result.status === "sent",
        detailAr:
          result.status === "sent"
            ? `أُرسل إلى واتساب رقم المنصة: ${filename}${text ? " مع نص" : ""}.`
            : result.status === "logged"
              ? `سُجّل الإرسال (المزوّد غير مفعّل فعلياً): ${filename}.`
              : `لم يُرسل الملف (${result.status}): ${result.error ?? "سبب غير معروف"}.`,
      };
    }
    const message = await sendWhatsApp({ to, body: text, kind: "agent_ops", relatedId: "team-chat" });
    const delivered = message.status === "sent" || message.status === "logged";
    return {
      ok: delivered,
      sent: message.status === "sent",
      detailAr:
        message.status === "sent"
          ? "أُرسل النص إلى واتساب رقم المنصة."
          : message.status === "logged"
            ? "سُجّل النص (المزوّد غير مفعّل فعلياً)."
            : "لم يُرسل النص إلى واتساب (فشل الإرسال).",
    };
  } catch (error) {
    return {
      ok: false,
      sent: false,
      detailAr: `فشل إرسال واتساب: ${error instanceof Error ? error.message.slice(0, 160) : "خطأ غير معروف"}.`,
    };
  }
}
