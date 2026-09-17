import { NextResponse } from "next/server";
import { redeemCard } from "@/lib/store";
import { defaultSettings } from "@/lib/settings";
import { getLiveSession } from "@/lib/auth/session";
import { setUserEntitlement } from "@/lib/auth/store";
import { notifyActivation } from "@/lib/whatsapp/notify";

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
  const phone = body.phone?.trim() || live.user.phone;
  const result = await redeemCard(body.code, name, phone, live.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  await setUserEntitlement(live.user.id, result.planId);
  const plan = defaultSettings.plans.find((item) => item.id === result.planId);
  const planName = plan?.arabicName ?? result.planId;
  await notifyActivation({
    phone: phone,
    name,
    planName,
    code: body.code,
    userId: live.user.id,
  });
  return NextResponse.json({
    ok: true,
    planId: result.planId,
    planName,
    message: `أهلاً ${name}! تم تفعيل ${planName} بنجاح.`,
  });
}
