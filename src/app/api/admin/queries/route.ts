import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { getMathQuery, listMathQueries, patchMathQuery } from "@/lib/solver";
import type { AuditStatus } from "@/lib/solver/types";

export const runtime = "nodejs";

const STATUSES: AuditStatus[] = ["pending", "verified", "needs_fix"];

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const queries = await listMathQueries({ limit: 300 });
  return NextResponse.json({ queries });
}

export async function PATCH(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = (await request.json()) as { id?: string; auditStatus?: AuditStatus; auditNote?: string };
  if (!body.id) return NextResponse.json({ error: "id required." }, { status: 400 });
  if (body.auditStatus && !STATUSES.includes(body.auditStatus)) {
    return NextResponse.json({ error: "Invalid auditStatus." }, { status: 400 });
  }
  const existing = await getMathQuery(body.id);
  if (!existing) return NextResponse.json({ error: "Query not found." }, { status: 404 });
  const query = await patchMathQuery(body.id, {
    auditStatus: body.auditStatus,
    auditNote: body.auditNote,
  });
  return NextResponse.json({ query });
}
