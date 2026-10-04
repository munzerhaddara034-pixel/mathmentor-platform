import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/hamza/sameOrigin";
import { clientIpFrom } from "@/lib/security/rateLimit";
import { DECISION_ACTIONS, decideProposal, type DecisionAction } from "@/lib/team/approval";
import { canApprove, requireTeamStaff, teamError } from "@/lib/team/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  action?: unknown;
  confirm?: unknown;
  step?: unknown;
  code?: unknown;
  reviewed?: unknown;
  allowLarge?: unknown;
  branch?: unknown;
  typedBranch?: unknown;
  text?: unknown;
};

function str(value: unknown, max = 120): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

/**
 * POST {action, confirm:true, …} — human click only, same-origin only.
 * issue_code {step:"open_pr"|"merge", branch?} · approve {code, reviewed} · merge {code, typedBranch} · reject · refresh_ci
 * · revise {text} (queues a new revision) · revert (merged → revert proposal)
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  if (!isSameOriginRequest(request.headers)) return teamError(403, "Cross-site request refused.", "طلب من موقع آخر مرفوض.");
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return teamError(400, "Invalid JSON.", "طلب غير صالح.");
  }
  const action = (DECISION_ACTIONS as readonly string[]).includes(String(body.action)) ? (body.action as DecisionAction) : null;
  if (!action) return teamError(400, "Unknown action.", "الإجراء غير صالح.");
  if (action !== "refresh_ci" && !canApprove(gate.actor)) {
    return teamError(403, "Not an approver.", "حسابك غير مخوّل بالموافقة على الـ Diff (TEAM_APPROVER_EMAILS).");
  }
  const { id } = await context.params;
  try {
    const result = await decideProposal({
      proposalId: id,
      action,
      confirm: body.confirm === true,
      step: body.step === "merge" ? "merge" : "open_pr",
      code: str(body.code, 40),
      reviewed: body.reviewed === true,
      allowLarge: body.allowLarge === true,
      branch: str(body.branch),
      typedBranch: str(body.typedBranch),
      text: str(body.text, 2000),
      actor: { ...gate.actor, ip: clientIpFrom(request.headers) },
    });
    if (!result.ok) return teamError(result.status, result.error, result.errorAr);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("team/proposals POST", error);
    return teamError(500, "Decision failed.", "تعذّر تنفيذ القرار.");
  }
}
