import { NextResponse } from "next/server";
import { requireTeamStaff, teamError } from "@/lib/team/guard";
import { listPrDrafts } from "@/lib/team/prDrafts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const gate = await requireTeamStaff(); if (!gate.ok) return gate.response;
  try { return NextResponse.json({ ok: true, drafts: await listPrDrafts() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return teamError(500, "Could not load PR drafts.", "تعذّر تحميل مسودّات PR."); }
}
