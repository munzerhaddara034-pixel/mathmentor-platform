import { NextResponse } from "next/server";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import {
  getLatestEvolution,
  isSundayBeirutMidnightWindow,
  runWeeklyExecutiveBrief,
} from "@/lib/agent/selfEvolution";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Weekly executive brief.
 * Cron: Sunday 00:00 Asia/Beirut → POST /api/agent/weekly-brief
 * Auth: JOBS_SECRET / AGENT_WEBHOOK_SECRET / staff session (demo if secrets empty).
 */
export async function GET(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;
  const latest = await getLatestEvolution();
  return NextResponse.json({
    ok: true,
    auth: auth.mode,
    schedule: "Sunday 00:00 Asia/Beirut",
    sundayWindowNow: isSundayBeirutMidnightWindow(),
    latest,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;

  let force = true;
  let notifyWhatsApp = true;
  try {
    const body = (await request.json()) as { force?: boolean; notifyWhatsApp?: boolean };
    if (typeof body.force === "boolean") force = body.force;
    if (typeof body.notifyWhatsApp === "boolean") notifyWhatsApp = body.notifyWhatsApp;
  } catch {
    /* empty body ok */
  }

  // Cron may omit force; still run when in Sunday window OR when force (hub/manual).
  if (!force && !isSundayBeirutMidnightWindow()) {
    return NextResponse.json({
      ok: true,
      skipped: "outside_sunday_00_beirut_window",
      hint: "Pass {\"force\":true} for manual run, or schedule Sunday 00:00 Asia/Beirut.",
      sundayWindowNow: false,
    });
  }

  try {
    const result = await runWeeklyExecutiveBrief({ force: true, notifyWhatsApp });
    return NextResponse.json({
      ok: true,
      auth: auth.mode,
      brand: "Prof. Munzer Haddara / الأستاذ منذر حداره",
      instructorWhatsApp: "96176532421",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "weekly-brief failed" },
      { status: 500 },
    );
  }
}
