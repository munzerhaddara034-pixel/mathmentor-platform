/**
 * Student "I paid" claims.
 *  POST (multipart): creates a PENDING claim + optional receipt image. It never activates a plan:
 *        activation happens only when the admin confirms in /admin/payments.
 *  GET:  the signed-in user's own claims.
 */
import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { clientIpFrom, paymentRateLimits, tooManyRequestsBody } from "@/lib/security/rateLimit";
import { isSameOriginRequest } from "@/lib/security/origin";
import { RECEIPT_MAX_BYTES, validateReceipt } from "@/lib/payments/receipt";
import { normalizePhone, validatePaymentClaim } from "@/lib/payments/validation";
import { resolveRegionForRequest } from "@/lib/pricing/regionServer";
import { listUserPayments, type NewReceipt } from "@/lib/payments/db";
import { paymentsAvailable, paymentsPool, submitPaymentClaim } from "@/lib/payments/service";
import { forbiddenOriginResponse, paymentErrorResponse, unavailableResponse } from "@/lib/payments/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Receipt (5 MB) + form fields + multipart overhead. */
const MAX_BODY_BYTES = RECEIPT_MAX_BYTES + 256 * 1024;
// "region" is accepted for old clients but ignored; "locationRegion" is the geolocation claim (one signal).
const FIELDS = ["payerName", "payerEmail", "payerPhone", "plan", "period", "region", "locationRegion", "amount", "currency", "method", "reference", "transferDate", "orderId"];

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!paymentsAvailable()) return NextResponse.json({ ok: true, available: false, payments: [] });
  try {
    const payments = await listUserPayments(await paymentsPool(), guard.live.user.id);
    return NextResponse.json({ ok: true, available: true, payments });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;
  if (user.role !== "student") {
    return NextResponse.json(
      { ok: false, error: "Only student accounts can submit a payment.", errorAr: "إرسال الدفعات متاح لحسابات الطلاب فقط." },
      { status: 403 },
    );
  }
  if (!isSameOriginRequest(request.headers)) return forbiddenOriginResponse();
  if (!paymentsAvailable()) return unavailableResponse();

  const ip = clientIpFrom(request.headers);
  for (const [limiter, key] of [
    [paymentRateLimits.submitUserHour, user.id],
    [paymentRateLimits.submitUserDay, user.id],
    [paymentRateLimits.submitIp, ip],
  ] as const) {
    const hit = limiter.hit(key);
    if (!hit.ok) return NextResponse.json(tooManyRequestsBody(hit.retryAfterSec), { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } });
  }

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return tooBig();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Send the form as multipart/form-data.", errorAr: "صيغة النموذج غير صحيحة." }, { status: 400 });
  }

  const fields: Record<string, string> = {};
  for (const name of FIELDS) {
    const value = form.get(name);
    if (typeof value === "string" && value !== "") fields[name] = value;
  }

  let receipt: NewReceipt | null = null;
  const file = form.get("receipt");
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > RECEIPT_MAX_BYTES) return tooBig();
    const bytes = Buffer.from(await file.arrayBuffer());
    const check = validateReceipt(bytes);
    if (!check.ok) {
      if (check.reason === "too_big") return tooBig();
      return NextResponse.json(
        { ok: false, field: "receipt", error: "Receipt must be a JPEG, PNG or WebP image.", errorAr: "الإيصال يجب أن يكون صورة JPEG أو PNG أو WebP." },
        { status: 415 },
      );
    }
    receipt = { mimeType: check.mimeType, sizeBytes: check.sizeBytes, sha256: check.sha256, bytes };
  }

  const validation = validatePaymentClaim(fields);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, field: validation.field, error: `Invalid ${validation.field}: ${validation.error}`, errorAr: "تحقّق من الحقول المطلوبة." },
      { status: 422 },
    );
  }

  try {
    // Region is decided HERE from server-side signals: location claim + offline IP country + phone on file.
    const region = resolveRegionForRequest({
      location: validation.value.locationRegion,
      headers: request.headers,
      phone: normalizePhone(user.contactPhone),
    });
    const outcome = await submitPaymentClaim({ user, claim: validation.value, region, receipt, ip });
    if (!outcome.ok) return NextResponse.json({ ok: false, field: outcome.field, error: outcome.error, errorAr: outcome.errorAr }, { status: outcome.status });
    return NextResponse.json(
      {
        ok: true,
        payment: outcome.payment,
        message: "Payment received. Your plan is activated only after Prof. Munzer Haddara confirms it.",
        messageAr: "تم استلام طلبك. يُفعَّل الاشتراك فقط بعد تأكيد الأستاذ منذر حداره.",
      },
      { status: 201 },
    );
  } catch (error) {
    return paymentErrorResponse(error);
  }
}

function tooBig() {
  return NextResponse.json(
    { ok: false, field: "receipt", error: "Receipt image is larger than 5 MB.", errorAr: "صورة الإيصال أكبر من 5 ميغابايت." },
    { status: 413 },
  );
}
