import { NextResponse } from "next/server";
import { requireTeamStaff, teamError } from "@/lib/team/guard";
import { medianDuration, readTeamHealth } from "@/lib/team/health";
import { TEAM_AGENT_IDS } from "@/lib/team/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → bounded team-agent observability for staff; no raw chat logs or student records. */
export async function GET() {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  try {
    const snapshot = await readTeamHealth();
    const agents = TEAM_AGENT_IDS.map((agent) => {
      const records = snapshot.records.filter((record) => record.agent === agent);
      const recent = records
        .filter((record) => record.outcome === "failed" || record.escalation)
        .slice(-8)
        .map((record) => ({
          at: record.createdAt,
          outcome: record.outcome,
          durationMs: record.durationMs,
          verified: record.verified,
          escalation: record.escalation,
          failure: record.failure,
          tools: record.tools,
        }));
      const memory = snapshot.memory[agent];
      return {
        agent,
        successCount: records.filter((record) => record.outcome === "success").length,
        failureCount: records.filter((record) => record.outcome === "failed").length,
        escalationCount: records.filter((record) => record.escalation).length,
        medianDurationMs: medianDuration(records),
        recent,
        memorySummaries: memory.summaries.slice(-6).map((summary) => ({
          at: summary.at,
          outcome: summary.outcome,
          verified: summary.verified,
          summary: summary.summary,
          tools: summary.tools,
        })),
      };
    });
    return NextResponse.json({ ok: true, agents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("team/health GET", error);
    return teamError(500, "Could not load team health.", "تعذّر تحميل صحة الفريق.");
  }
}
