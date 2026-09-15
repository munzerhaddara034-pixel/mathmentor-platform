import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { redeemPromoCode } from "@/lib/auth/entitlements";
import { scopeLabel } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.error;
  if (gate.user.role !== "student") {
    return NextResponse.json({ error: "التفعيل متاح لحساب الطالب فقط" }, { status: 403 });
  }
  const body = (await request.json()) as { code?: string };
  if (!body.code) return NextResponse.json({ error: "أدخل رمز البطاقة" }, { status: 400 });
  const result = redeemPromoCode({
    code: body.code,
    userId: gate.user.id,
    name: gate.user.name,
    phone: gate.user.phone,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const planName = scopeLabel(result.scopeKind, result.scopeId);
  return NextResponse.json({
    ok: true,
    scopeKind: result.scopeKind,
    scopeId: result.scopeId,
    planName,
    entitlements: result.entitlements,
    message: `أهلاً ${gate.user.name}! تم تفعيل ${planName} على حسابك.`,
  });
}
