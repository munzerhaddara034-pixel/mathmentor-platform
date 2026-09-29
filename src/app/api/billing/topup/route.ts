import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { createTopUpCodes, listTopUpCodes } from "@/lib/billing/store";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  return NextResponse.json({ codes: await listTopUpCodes() });
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = (await request.json()) as {
    prefix?: string;
    code?: string;
    liveHours?: number;
    count?: number;
    note?: string;
    expiresAt?: string;
  };
  const hours = Number(body.liveHours ?? 2);
  if (!Number.isFinite(hours) || hours < 1) {
    return NextResponse.json({ error: "liveHours must be >= 1." }, { status: 400 });
  }
  const created = await createTopUpCodes({
    prefix: body.prefix,
    code: body.code,
    liveHours: hours,
    count: body.count,
    note: body.note,
    expiresAt: body.expiresAt,
    createdBy: guard.live.user.id,
  });
  return NextResponse.json({ ok: true, created });
}
