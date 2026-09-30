import { NextResponse } from "next/server";
import { decideProposal } from "@/lib/team/approval";
import { canApprove, requireTeamStaff, teamError } from "@/lib/team/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: unknown; confirm?: unknown; branch?: unknown; confirmBranch?: unknown };

/** POST {action:"approve"|"reject", confirm:true, branch?, confirmBranch?} — human click only. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  if (!canApprove(gate.actor)) {
    return teamError(403, "Not an approver.", "حسابك غير مخوّل بالموافقة على الـ Diff (TEAM_APPROVER_EMAILS).");
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return teamError(400, "Invalid JSON.", "طلب غير صالح.");
  }
  const action = body.action === "approve" || body.action === "reject" ? body.action : null;
  if (!action) return teamError(400, "action must be approve or reject.", "الإجراء غير صالح.");
  const { id } = await context.params;
  try {
    const result = await decideProposal({
      proposalId: id,
      action,
      confirm: body.confirm === true,
      branch: typeof body.branch === "string" ? body.branch : undefined,
      confirmBranch: typeof body.confirmBranch === "string" ? body.confirmBranch : undefined,
      actor: gate.actor,
    });
    if (!result.ok) return teamError(result.status, result.error, result.errorAr);
    return NextResponse.json({ ok: true, proposal: result.proposal, message: result.message });
  } catch (error) {
    console.error("team/proposals POST", error);
    return teamError(500, "Decision failed.", "تعذّر تنفيذ القرار.");
  }
}
