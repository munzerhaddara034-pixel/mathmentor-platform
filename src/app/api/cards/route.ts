import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { createScratchCards, readStore } from "@/lib/store";

export async function GET() {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const store = await readStore();
  return NextResponse.json({ cards: store.scratchCards, entitlements: store.entitlements });
}

export async function POST(request: Request) {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const body = (await request.json()) as {
    code?: string;
    planId?: string;
    count?: number;
    note?: string;
    expiresAt?: string;
  };
  if (!body.planId) return NextResponse.json({ error: "اختر الدورة أو الصف" }, { status: 400 });
  const created = await createScratchCards({
    code: body.code,
    planId: body.planId,
    count: body.count,
    note: body.note,
    expiresAt: body.expiresAt,
  });
  return NextResponse.json({ created });
}
