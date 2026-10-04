import { NextResponse } from "next/server";
import { redeemCard } from "@/lib/store";
import { defaultSettings } from "@/lib/settings";
import { getLiveSession } from "@/lib/auth/session";
import { setUserEntitlement, userAccess } from "@/lib/auth/store";
import { isStaffRole } from "@/lib/auth/paths";
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
  const body = (await request.json()) as { code?: string; name?: string; phone?: string };
  if (!body.code) return NextResponse.json({ error: "أدخل رمز البطاقة" }, { status: 400 });
  const name = body.name?.trim() || live.user.name;
  // The user's real phone only (never the display fallback number used for watermarks).
  const phone = body.phone?.trim() || live.user.contactPhone || "";
  const { redeemTopUp } = await import("@/lib/billing/store");
  const topup = await redeemTopUp(body.code, live.user.id, name);
  if (topup.ok) {
    const access = isStaffRole(live.user.role)
      ? { aiAccess: true, liveAccess: true, subscribed: true, subscriptionType: live.user.subscriptionType, liveCredits: topup.liveCredits }
      : await userAccess({ ...live.user, liveCredits: topup.liveCredits });
    return NextResponse.json({
      ok: true,
      planId: "live-topup",
      planName: `${topup.hours} live hours`,
      liveCredits: topup.liveCredits,
      aiAccess: access.aiAccess,
      liveAccess: access.liveAccess,
      subscribed: access.subscribed,
      subscriptionType: access.subscriptionType,
      message: `أهلاً ${name}! تم شحن ${topup.hours} ساعة مباشرة. الرصيد ${topup.liveCredits}.`,
    });
  }
  const result = await redeemCard(body.code, name, phone || undefined, live.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const updated = await setUserEntitlement(live.user.id, result.planId);
  const { recordActivation } = await import("@/lib/billing/store");
  await recordActivation(live.user.id, result.planId, body.code.trim());
  const plan = defaultSettings.plans.find((item) => item.id === result.planId);
  const planName = plan?.arabicName ?? result.planId;
  if (phone) {
    await notifyActivation({
      phone,
      name,
      planName,
      code: body.code,
      userId: live.user.id,
    });
  }
  const accessUser = updated ?? live.user;
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
