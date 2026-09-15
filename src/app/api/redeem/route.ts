import { NextResponse } from "next/server";
import { redeemCard } from "@/lib/store";
import { defaultSettings } from "@/lib/settings";

export async function POST(request: Request) {
  const body = (await request.json()) as { code?: string; name?: string; phone?: string };
  if (!body.code) return NextResponse.json({ error: "أدخل رمز البطاقة" }, { status: 400 });
  const result = await redeemCard(body.code, body.name || "طالب", body.phone);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const plan = defaultSettings.plans.find((item) => item.id === result.planId);
  return NextResponse.json({
    ok: true,
    planId: result.planId,
    planName: plan?.arabicName ?? result.planId,
    message: `أهلاً ${body.name || "بك"}! تم تفعيل ${plan?.arabicName ?? "الاشتراك"} بنجاح.`,
  });
}
