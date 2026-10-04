/**
 * Admin-only "Confirm": the ONLY place a payment claim activates a subscription.
 * Transactional + idempotent (see confirmPayment); audited into mm_audit_log in the same transaction.
 */
import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth/guards";
import { clientIpFrom, paymentRateLimits, tooManyRequestsBody } from "@/lib/security/rateLimit";
import { isSameOriginRequest } from "@/lib/security/origin";
import { validateConfirmBody } from "@/lib/payments/validation";
import { confirmPaymentAsAdmin, paymentsAvailable } from "@/lib/payments/service";
import { actorOf, forbiddenOriginResponse, paymentErrorResponse, unavailableResponse } from "@/lib/payments/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiRequireAdmin();
  if (guard.error) return guard.error;
  if (!isSameOriginRequest(request.headers)) return forbiddenOriginResponse();
  if (!paymentsAvailable()) return unavailableResponse();
  const admin = guard.live.user;
  const hit = paymentRateLimits.adminAction.hit(admin.id);
  if (!hit.ok) return NextResponse.json(tooManyRequestsBody(hit.retryAfterSec), { status: 429 });

  const body = await request.json().catch(() => ({}));
  const parsed = validateConfirmBody(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error, errorAr: "بيانات التأكيد غير صحيحة." }, { status: 422 });

  const { id } = await params;
  try {
    const result = await confirmPaymentAsAdmin({
      paymentId: id,
      admin: actorOf(admin),
      ip: clientIpFrom(request.headers),
      expiresAt: parsed.expiresAt,
      note: parsed.note,
    });
    return NextResponse.json({
      ok: true,
      status: "confirmed",
      alreadyConfirmed: result.alreadyConfirmed,
      payment: result.payment,
      message: result.alreadyConfirmed ? "Already confirmed — nothing changed." : "Confirmed. The subscription is active.",
      messageAr: result.alreadyConfirmed ? "مؤكَّدة مسبقاً — لم يتغيّر شيء." : "تم التأكيد وتفعيل الاشتراك.",
    });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
