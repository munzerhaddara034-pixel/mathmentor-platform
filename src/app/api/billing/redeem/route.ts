import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { redeemTopUp } from "@/lib/billing/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const body = (await request.json()) as { code?: string };
  if (!body.code?.trim()) {
    return NextResponse.json({ error: "أدخل رمز الشحن", errorEn: "Enter a top-up code." }, { status: 400 });
  }
  const result = await redeemTopUp(body.code, guard.live.user.id, guard.live.user.name);
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
