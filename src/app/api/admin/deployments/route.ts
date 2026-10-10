import { NextResponse } from "next/server";
import { canApprove, requireTeamStaff, teamError } from "@/lib/team/guard";
import { isSameOriginRequest } from "@/lib/security/origin";
import { activateStagingDeploy, listDeploymentAudits, listDeployments, requestDeploy } from "@/lib/ops/deployments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  try {
    return NextResponse.json({ ok: true, deployments: await listDeployments(), audits: await listDeploymentAudits(), canApprove: canApprove(gate.actor) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return teamError(500, "Could not load deployments.", "تعذّر تحميل عمليات النشر.");
  }
}

export async function POST(request: Request) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  if (!isSameOriginRequest(request.headers)) return teamError(403, "Cross-site request refused.", "طلب من موقع آخر مرفوض.");
  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // The operation below returns the localized missing/invalid field notice.
  }
  const result = await requestDeploy({ target: body.target as "staging" | "production", commit: typeof body.commit === "string" ? body.commit : "", reason: typeof body.reason === "string" ? body.reason : "", requestedBy: gate.actor.name || gate.actor.id });
  if (!result.ok) return teamError(result.status, result.error, result.errorAr);
  const activated = result.deployment.target === "staging" ? await activateStagingDeploy(result.deployment.id, gate.actor) : result;
  if (!activated.ok) return teamError(activated.status, activated.error, activated.errorAr);
  return NextResponse.json({ ok: true, deployment: activated.deployment }, { headers: { "Cache-Control": "no-store" } });
}
