/** Admin-only access to the first-party error log: read the summary + rows, or clear the log. */
import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { clearOpsErrors, errorSummary, listOpsErrors, OPS_ERRORS_MAX } from "@/lib/ops/errorLog";
import "@/lib/ops/errorLogStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function staffGuard(): Promise<NextResponse | null> {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const denied = await staffGuard();
  if (denied) return denied;
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 1), OPS_ERRORS_MAX) : 50;
  const [summary, errors] = await Promise.all([errorSummary(), listOpsErrors(limit)]);
  return NextResponse.json({ summary, errors });
}

export async function DELETE() {
  const denied = await staffGuard();
  if (denied) return denied;
  return NextResponse.json({ cleared: await clearOpsErrors() });
}