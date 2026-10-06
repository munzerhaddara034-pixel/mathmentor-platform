import { NextResponse } from "next/server";
import { readHamzaAudit, summarizeActivity, type HamzaActivityEvent } from "@/lib/hamza/activity";
import { hamzaConfig } from "@/lib/hamza/config";
import { beirutMonth } from "@/lib/hamza/cost";
import { hamzaReadiness } from "@/lib/hamza/readiness";
import { hamzaTaskRepo } from "@/lib/hamza/tasks/store";
import { publicTask } from "@/lib/hamza/tasks/types";
import { requireTeamStaff, teamError } from "@/lib/team/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → Hamza activity & cost for the current Beirut month (staff only; read-only). */
export async function GET() {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  try {
    const config = hamzaConfig();
    const month = beirutMonth(new Date());
    const tasks = (await hamzaTaskRepo().listRecent(200)).map(publicTask);
    let events: HamzaActivityEvent[] = [];
    try {
      events = await readHamzaAudit(200);
    } catch (error) {
      console.error("team/hamza/activity audit", error);
    }
    const activity = summarizeActivity({
      monthKey: month.key,
      monthStartIso: month.startIso,
      tasks,
      events,
      caps: { monthCapUsd: config.budgets.monthlyUsd, taskCapUsd: config.budgets.taskUsd, taskMaxUsd: config.budgets.taskMaxUsd },
    });
    return NextResponse.json({ ok: true, activity, hamza: hamzaReadiness() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("team/hamza/activity GET", error);
    return teamError(500, "Could not load Hamza activity.", "تعذّر تحميل نشاط حمزة.");
  }
}
