import { NextResponse } from "next/server";
import { defaultSettings } from "@/lib/settings";
import { getLiveSession } from "@/lib/auth/session";
import { userAccess } from "@/lib/auth/store";
import { isStaffRole } from "@/lib/auth/paths";
import { redeemCode } from "@/lib/cards/redeem";
import { clientIpFrom, hitRedeemLimits, tooManyRequestsBody } from "@/lib/security/rateLimit";
import { notifyActivation } from "@/lib/whatsapp/notify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const live = await getLiveSession();
  if (!live.ok) {
    return NextResponse.json(
      {
        error: live.reason === "replaced" ? "Signed in on another device." : "Sign in required.",
        errorAr: live.reason === "replaced" ? "تم الدخول من جهاز آخر." : "يلزم تسجيل الدخول.",
        reason: live.reason,
      },
      { status: 401 },
    );
  }
  // 10 attempts / 15 min per account (30 per IP), shared with /api/billing/redeem.
  const limit = hitRedeemLimits(live.user.id, clientIpFrom(request.headers));
  if (!limit.ok) {
    const body = tooManyRequestsBody(limit.retryAfterSec);
    return NextResponse.json({ ...body, error: body.errorAr, errorEn: body.error }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    });
  }
  const body = (await request.json().catch(() => ({}))) as { code?: unknown; name?: unknown; phone?: unknown };
  const code = typeof body.code === "string" ? body.code.trim().slice(0, 80) : "";
  if (!code) return NextResponse.json({ error: "أدخل رمز البطاقة" }, { status: 400 });
  const name = (typeof body.name === "string" ? body.name.trim().slice(0, 120) : "") || live.user.name;
  // The user's real phone only (never the display fallback number used for watermarks).
  const phone = (typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "") || live.user.contactPhone || "";

  const result = await redeemCode({ code, userId: live.user.id, name, phone: phone || undefined });
  if (!result.ok) return NextResponse.json({ error: result.error, errorEn: result.errorEn }, { status: result.status });

  if (result.kind === "topup") {
    const access = isStaffRole(live.user.role)
      ? { aiAccess: true, liveAccess: true, subscribed: true, subscriptionType: live.user.subscriptionType, liveCredits: result.liveCredits }
      : await userAccess({ ...live.user, liveCredits: result.liveCredits });
    return NextResponse.json({
      ok: true,
      planId: "live-topup",
      planName: `${result.hours} live hours`,
      liveCredits: result.liveCredits,
      aiAccess: access.aiAccess,
      liveAccess: access.liveAccess,
      subscribed: access.subscribed,
      subscriptionType: access.subscriptionType,
      message: `أهلاً ${name}! تم شحن ${result.hours} ساعة مباشرة. الرصيد ${result.liveCredits}.`,
    });
  }

  const plan = defaultSettings.plans.find((item) => item.id === result.planId);
  const planName = plan?.arabicName ?? result.planId;
  if (phone) {
    // After the lock is released: a slow WhatsApp call never holds the redeem transaction open.
    await notifyActivation({
      phone,
      name,
      planName,
      code: result.code,
      userId: live.user.id,
    });
  }
  const accessUser = result.user;
  const access = isStaffRole(accessUser.role)
    ? {
        aiAccess: true,
        liveAccess: true,
        subscribed: true,
        subscriptionType: accessUser.subscriptionType,
        liveCredits: accessUser.liveCredits,
      }
    : await userAccess(accessUser);
  return NextResponse.json({
    ok: true,
    planId: result.planId,
    planName,
    aiAccess: access.aiAccess,
    liveAccess: access.liveAccess,
    subscribed: access.subscribed,
    subscriptionType: access.subscriptionType,
    liveCredits: access.liveCredits,
    message: `أهلاً ${name}! تم تفعيل ${planName} بنجاح.`,
  });
}
