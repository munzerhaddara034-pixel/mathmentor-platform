/** Admin-only payment instructions (Whish / OMT number, beneficiary, enabled). Audited on change. */
import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth/guards";
import { clientIpFrom, paymentRateLimits, tooManyRequestsBody } from "@/lib/security/rateLimit";
import { isSameOriginRequest } from "@/lib/security/origin";
import { getPaymentSettings, readStoredPaymentSettings, savePaymentSettings } from "@/lib/payments/service";
import { actorOf, forbiddenOriginResponse } from "@/lib/payments/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await apiRequireAdmin();
  if (guard.error) return guard.error;
  return NextResponse.json({ ok: true, effective: await getPaymentSettings(), stored: await readStoredPaymentSettings().catch(() => ({})) });
}

export async function PUT(request: Request) {
  const guard = await apiRequireAdmin();
  if (guard.error) return guard.error;
  if (!isSameOriginRequest(request.headers)) return forbiddenOriginResponse();
  const hit = paymentRateLimits.adminAction.hit(guard.live.user.id);
  if (!hit.ok) return NextResponse.json(tooManyRequestsBody(hit.retryAfterSec), { status: 429 });
  const body = await request.json().catch(() => null);
  try {
    const effective = await savePaymentSettings(body, actorOf(guard.live.user), clientIpFrom(request.headers));
    return NextResponse.json({ ok: true, effective });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid settings.", errorAr: "إعدادات غير صحيحة." },
      { status: 422 },
    );
  }
}
