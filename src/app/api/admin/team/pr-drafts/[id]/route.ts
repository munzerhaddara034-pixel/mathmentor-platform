import { NextResponse } from "next/server";
import { requireTeamStaff, teamError } from "@/lib/team/guard";
import { createDraftPullRequest } from "@/lib/team/prDrafts";
import { isSameOriginRequest } from "@/lib/security/origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTeamStaff(); if (!gate.ok) return gate.response;
  if (!isSameOriginRequest(request.headers)) return teamError(403, "Cross-site request refused.", "طلب من موقع آخر مرفوض.");
  const { id } = await context.params;
  try { const result = await createDraftPullRequest(id); if (!result.ok) return teamError(result.status, result.error, result.errorAr); return NextResponse.json({ ok: true, draft: { ...result.draft, patch: undefined } }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return teamError(502, "GitHub PR creation failed.", "تعذّر إنشاء الـ PR عبر GitHub."); }
}
