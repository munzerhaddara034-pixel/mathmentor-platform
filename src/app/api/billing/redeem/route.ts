import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { redeemTopUp } from "@/lib/billing/store";
import { clientIpFrom, hitRedeemLimits, tooManyRequestsBody } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  // Same buckets as /api/redeem (10 / 15 min per account, 30 per IP).
  const limit = hitRedeemLimits(guard.live.user.id, clientIpFrom(request.headers));
  if (!limit.ok) {
    const body = tooManyRequestsBody(limit.retryAfterSec);
    return NextResponse.json({ ...body, error: body.errorAr, errorEn: body.error }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    });
  }
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code.trim().slice(0, 80) : "";
  if (!code) {
    return NextResponse.json({ error: "أدخل رمز الشحن", errorEn: "Enter a top-up code." }, { status: 400 });
  }
  // Atomic: card claim + credit + ledger in one locked unit (see redeemTopUp).
  const result = await redeemTopUp(code, guard.live.user.id, guard.live.user.name);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, errorEn: result.errorEn }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    hours: result.hours,
    liveCredits: result.liveCredits,
    message: `Added ${result.hours} live hour(s). Balance: ${result.liveCredits}.`,
    messageAr: `أُضيفت ${result.hours} ساعة مباشرة. الرصيد: ${result.liveCredits}.`,
  });
}
