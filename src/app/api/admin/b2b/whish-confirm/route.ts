import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { listB2bWhishPayments, recordB2bWhishPayment } from "@/lib/b2b/whishOps";

export const runtime = "nodejs";

const bodySchema = z.object({
  referenceId: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
  planLabel: z.string().min(1).max(120),
  amountUsd: z.coerce.number().positive().max(100_000),
});

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const payments = await listB2bWhishPayments(50);
  return NextResponse.json({ ok: true, payments });
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Staff only.", errorAr: "للطاقم فقط." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON.", errorAr: "طلب غير صالح." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "referenceId, planLabel, and amountUsd required.",
        errorAr: "يلزم رقم المرجع والباقة والمبلغ.",
      },
      { status: 400 },
    );
  }

  const result = await recordB2bWhishPayment({
    referenceId: parsed.data.referenceId,
    note: parsed.data.note,
    planLabel: parsed.data.planLabel,
    amountUsd: parsed.data.amountUsd,
    recordedByUserId: guard.live.user.id,
    recordedByName: guard.live.user.name,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    payment: result.payment,
    message: "Saved. Admin notified to activate account and generate subscription card.",
    messageAr: "تم الحفظ. أُخطِر المشرف لتفعيل الحساب وإصدار بطاقة الاشتراك.",
  });
}
