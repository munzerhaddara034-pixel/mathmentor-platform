import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { createPromoCodes, listPromoCodes, promoStats } from "@/lib/auth/entitlements";
import { SCOPE_OPTIONS, type ScopeKind } from "@/lib/access";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  return NextResponse.json({
    cards: listPromoCodes(),
    stats: promoStats(),
    scopes: SCOPE_OPTIONS,
  });
}

export async function POST(request: Request) {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const body = (await request.json()) as {
    code?: string;
    planId?: string;
    scopeKind?: ScopeKind;
    scopeId?: string;
    count?: number;
    note?: string;
    expiresAt?: string;
  };
  const scopeKind = body.scopeKind ?? "plan";
  const scopeId = body.scopeId ?? body.planId;
  if (!scopeId) return NextResponse.json({ error: "اختر الدورة أو الصف أو الوحدة" }, { status: 400 });
  try {
    const created = createPromoCodes({
      scopeKind,
      scopeId,
      count: body.count,
      note: body.note,
      expiresAt: body.expiresAt,
      code: body.code,
    });
    return NextResponse.json({ created, stats: promoStats() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر توليد الأكواد";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
