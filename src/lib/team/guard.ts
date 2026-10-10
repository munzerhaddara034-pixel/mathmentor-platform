/** Staff-only gate for every /api/admin/team route (§2.4). */
import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import type { TeamActor } from "./agents";
export { canApprove } from "./canApprove";

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

/**
 * Who may click «موافقة ونشر»: TEAM_APPROVER_EMAILS (comma-separated, case-insensitive);
 * when unset it falls back to the ADMIN_EMAILS allowlist (src/lib/auth/adminAllowlist.ts).
 */
