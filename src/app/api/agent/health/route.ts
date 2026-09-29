import { NextResponse } from "next/server";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import { collectPlatformHealth } from "@/lib/agent/health";
import { agentOverview } from "@/lib/agent/store";
import { getLatestEvolution, collectSelfEvolutionMetrics } from "@/lib/agent/selfEvolution";
import { listAwaitingApprovals } from "@/lib/agent/approvalWorkflow";
import { notifyInstructorHubCompletion } from "@/lib/agent/whatsappSender";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;

  try {
    const health = await collectPlatformHealth();
    const overview = await agentOverview();
    const awaitingApprovals = await listAwaitingApprovals(12);
    let evolution = overview.evolution || (await getLatestEvolution());
    const url = new URL(request.url);
    if (!evolution && url.searchParams.get("evolve") === "1") {
      evolution = await collectSelfEvolutionMetrics();
    }
    const notify =
      url.searchParams.get("notifyWhatsApp") === "1" ||
      url.searchParams.get("notify") === "1";

    let outboundWhatsApp = undefined;
    let whatsappReply = undefined;
    let task = undefined;
    if (notify) {
      const wa = await notifyInstructorHubCompletion({
        intentKind: "platform_health",
        status: "completed",
        transcript: "Agent Hub · فحص صحة المنصّة",
        health,
        relatedIds: [health.id],
      });
      outboundWhatsApp = wa.outbound;
      whatsappReply = wa.replyAr;
      task = wa.task;
    }

    return NextResponse.json({
      ok: true,
      auth: auth.mode,
      health,
      overview: {
        ...overview,
        approvals: overview.approvals ?? awaitingApprovals,
        evolution,
      },
      awaitingApprovals,
      evolution,
      ...(notify ? { outboundWhatsApp, whatsappReply, task } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "health failed" },
      { status: 500 },
    );
  }
}
