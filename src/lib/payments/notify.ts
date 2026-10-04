/**
 * Payment notifications. Owner: e-mail (receipt attached) + WhatsApp text (+ receipt image when the
 * provider can send bytes) + in-app for admins only. Student: in-app + e-mail + WhatsApp.
 * Student WhatsApp goes ONLY to a phone the student really gave (never the display fallback).
 * Every function swallows channel errors and reports whether at least one channel delivered.
 */
import { sendEmail } from "@/lib/email/sender";
import { sendWhatsApp } from "@/lib/whatsapp/adapter";
import { listPublicUsers, publicUserById } from "@/lib/auth/store";
import { ownerEmailAddress, ownerWhatsAppNumber } from "./config";
import { ownerAlertText, ownerEmail, studentResultText } from "./messages";
import type { NewReceipt } from "./db";
import type { PaymentRecord } from "./types";

function extensionFor(mime: string): string {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}

function log(channel: string, error: unknown) {
  console.error(`[mathmentor][payments] ${channel} failed:`, error instanceof Error ? error.message : String(error));
}

export async function notifyOwnerOfSubmission(payment: PaymentRecord, receipt: NewReceipt | null, adminLink: string): Promise<boolean> {
  let delivered = false;
  const filename = receipt ? `receipt-${payment.id}.${extensionFor(receipt.mimeType)}` : "";

  try {
    const mail = ownerEmail(payment, adminLink);
    const result = await sendEmail({
      to: ownerEmailAddress(),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: receipt ? [{ filename, content: receipt.bytes.toString("base64") }] : undefined,
    });
    if (result.ok) delivered = true;
    else log("owner e-mail", result.error);
  } catch (error) {
    log("owner e-mail", error);
  }

  const alert = ownerAlertText(payment, adminLink);
  try {
    const message = await sendWhatsApp({
      to: ownerWhatsAppNumber(),
      kind: "payment_submitted",
      relatedId: payment.id,
      body: alert.body,
      bodyAr: alert.bodyAr,
    });
    if (message.status === "sent") delivered = true;
  } catch (error) {
    log("owner WhatsApp", error);
  }

  if (receipt) {
    try {
      const { sendWhatsAppMedia } = await import("@/lib/whatsapp/media/send");
      await sendWhatsAppMedia(
        ownerWhatsAppNumber(),
        { type: "image", bytes: receipt.bytes, mimeType: receipt.mimeType, filename, caption: `Receipt · ${payment.payerName} · ${payment.reference}` },
        { relatedId: payment.id },
      );
    } catch (error) {
      log("owner WhatsApp image", error);
    }
  }

  try {
    const { pushNotification } = await import("@/lib/notifications/store");
    const admins = (await listPublicUsers()).filter((user) => user.role === "admin");
    for (const admin of admins) {
      await pushNotification({
        userId: admin.id,
        audience: "teacher",
        kind: "payment",
        title: `Payment pending · ${payment.payerName} · ${payment.amount} USD`,
        titleAr: `دفعة بانتظار المراجعة · ${payment.payerName} · ${payment.amount} USD`,
        body: `${payment.method.toUpperCase()} ref ${payment.reference} · ${payment.plan} (${payment.period})`,
        bodyAr: `${payment.method.toUpperCase()} المرجع ${payment.reference} · ${payment.plan}`,
        href: `/admin/payments?id=${encodeURIComponent(payment.id)}`,
        relatedId: `pay-${payment.id}-pending`,
      });
    }
    if (admins.length) delivered = true;
  } catch (error) {
    log("admin in-app", error);
  }
  return delivered;
}

export async function notifyStudentOfReview(payment: PaymentRecord): Promise<boolean> {
  if (payment.status === "pending") return false;
  const text = studentResultText(payment);
  const user = await publicUserById(payment.userId).catch(() => undefined);
  let delivered = false;

  try {
    const { pushNotification } = await import("@/lib/notifications/store");
    await pushNotification({
      userId: payment.userId,
      audience: "student",
      kind: "payment",
      title: text.title,
      titleAr: text.titleAr,
      body: text.body,
      bodyAr: text.bodyAr,
      href: "/wallet/pay",
      relatedId: `pay-${payment.id}-${payment.status}`,
    });
    delivered = true;
  } catch (error) {
    log("student in-app", error);
  }

  const email = payment.payerEmail || user?.email || "";
  if (email) {
    try {
      const result = await sendEmail({ to: email, subject: text.subject, text: `${text.body}\n\n${text.bodyAr}` });
      if (result.ok) delivered = true;
    } catch (error) {
      log("student e-mail", error);
    }
  }

  // Only a number the student actually gave: the form's phone, else the saved account phone.
  const phone = payment.payerPhone || user?.contactPhone || "";
  if (phone) {
    try {
      const message = await sendWhatsApp({ to: phone, kind: "payment_result", relatedId: payment.id, body: text.body, bodyAr: text.bodyAr });
      if (message.status === "sent") delivered = true;
    } catch (error) {
      log("student WhatsApp", error);
    }
  }
  return delivered;
}
