/** Admin-only "Not received": records the note, notifies the student, audited. Never activates. */
import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth/guards";
import { clientIpFrom, paymentRateLimits, tooManyRequestsBody } from "@/lib/security/rateLimit";
import { isSameOriginRequest } from "@/lib/security/origin";
import { validateRejectNote } from "@/lib/payments/validation";
import { paymentsAvailable, rejectPaymentAsAdmin } from "@/lib/payments/service";
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

  const body = (await request.json().catch(() => ({}))) as { note?: unknown };
  const note = validateRejectNote(body.note);
  if (!note.ok) return NextResponse.json({ ok: false, error: note.error, errorAr: "اكتب سبب الرفض." }, { status: 422 });

  const { id } = await params;
  try {
    const result = await rejectPaymentAsAdmin({ paymentId: id, admin: actorOf(admin), note: note.note, ip: clientIpFrom(request.headers) });
    return NextResponse.json({ ok: true, status: "rejected", alreadyRejected: result.alreadyRejected, payment: result.payment });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
