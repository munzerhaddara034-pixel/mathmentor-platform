import { NextResponse } from "next/server";
import { canApprove, requireTeamStaff, teamError } from "@/lib/team/guard";
import { isSameOriginRequest } from "@/lib/security/origin";
import { rollbackDeploy } from "@/lib/ops/deployments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  if (!isSameOriginRequest(request.headers)) return teamError(403, "Cross-site request refused.", "طلب من موقع آخر مرفوض.");
  if (!canApprove(gate.actor)) return teamError(403, "Only the owner may roll back a deployment.", "المالك فقط يستطيع التراجع عن النشر.");
  const { id } = await context.params;
  const result = await rollbackDeploy(id, gate.actor);
  if (!result.ok) return teamError(result.status, result.error, result.errorAr);
  return NextResponse.json({ ok: true, deployment: result.deployment }, { headers: { "Cache-Control": "no-store" } });
}
