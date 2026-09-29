/** Staff-only gate for every /api/admin/team route (§2.4). */
import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import type { TeamActor } from "./agents";

export type TeamGate = { ok: true; actor: TeamActor } | { ok: false; response: NextResponse };

export function teamError(status: number, error: string, errorAr: string) {
  return NextResponse.json({ ok: false, error, errorAr }, { status });
}

export async function requireTeamStaff(): Promise<TeamGate> {
  const guard = await apiSession();
  if (guard.error) return { ok: false, response: guard.error };
  const user = guard.live.user;
  if (!isStaffRole(user.role)) {
    return { ok: false, response: teamError(403, "Staff only.", "هذه الصفحة لفريق العمل فقط.") };
  }
  return { ok: true, actor: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

/** Optional TEAM_APPROVER_EMAILS (comma-separated) narrows who may click «موافقة ونشر». */
export function canApprove(actor: TeamActor): boolean {
  const list = (process.env.TEAM_APPROVER_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return true;
  return list.includes(actor.email.toLowerCase());
}
