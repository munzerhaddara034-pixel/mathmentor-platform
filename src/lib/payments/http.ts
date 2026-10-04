/** Shared HTTP helpers for the payment routes (error bodies, actor shape). */
import { NextResponse } from "next/server";
import type { PublicUser } from "@/lib/auth/store";
import { PaymentError } from "./db";

const MESSAGES: Record<PaymentError["code"], { en: string; ar: string }> = {
  duplicate_reference: {
    en: "This transaction reference was already submitted. If it was marked “not received”, you can submit it again.",
    ar: "رقم العملية هذا مُرسَل من قبل. إذا رُفض («لم يُستلم») يمكنك إرساله من جديد.",
  },
  pending_exists: {
    en: "You already have a pending payment for this plan. Wait for the review.",
    ar: "لديك دفعة قيد المراجعة لهذه الباقة. انتظر المراجعة.",
  },
  too_many_pending: { en: "Too many payments waiting for review.", ar: "دفعات كثيرة بانتظار المراجعة." },
  not_found: { en: "Payment not found.", ar: "الدفعة غير موجودة." },
  already_confirmed: { en: "This payment is already confirmed.", ar: "هذه الدفعة مؤكَّدة مسبقاً." },
  already_rejected: { en: "This payment was marked not received.", ar: "هذه الدفعة مسجّلة «لم تُستلم»." },
  user_not_found: { en: "Student account not found.", ar: "حساب الطالب غير موجود." },
};

export function paymentErrorResponse(error: unknown): NextResponse {
  if (error instanceof PaymentError) {
    const message = MESSAGES[error.code];
    return NextResponse.json({ ok: false, code: error.code, error: message.en, errorAr: message.ar }, { status: error.status });
  }
  console.error("[mathmentor][payments] request failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ ok: false, error: "Payment request failed.", errorAr: "تعذّر تنفيذ طلب الدفع." }, { status: 500 });
}

export function unavailableResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Payments need the database (DATABASE_URL).", errorAr: "الدفع يحتاج قاعدة البيانات." },
    { status: 503 },
  );
}

export function forbiddenOriginResponse(): NextResponse {
  return NextResponse.json({ ok: false, error: "Cross-site request refused.", errorAr: "طلب مرفوض." }, { status: 403 });
}

export function actorOf(user: PublicUser) {
  return { id: user.id, email: user.email, role: user.role };
}

export function isVerifiedAdmin(user: Pick<PublicUser, "role" | "emailVerified">): boolean {
  return user.role === "admin" && user.emailVerified === true;
}
