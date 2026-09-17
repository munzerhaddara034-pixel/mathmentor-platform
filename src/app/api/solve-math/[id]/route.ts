import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { getMathQuery, patchMathQuery } from "@/lib/solver";
import type { StudentRating } from "@/lib/solver/types";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const { id } = await context.params;
  const query = await getMathQuery(id);
  if (!query) return NextResponse.json({ error: "Query not found." }, { status: 404 });
  if (!isStaffRole(guard.live.user.role) && query.userId !== guard.live.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return NextResponse.json({
    query,
    playerPath: `/lessons/interactive-explanation?id=${encodeURIComponent(query.id)}`,
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const { id } = await context.params;
  const query = await getMathQuery(id);
  if (!query) return NextResponse.json({ error: "Query not found." }, { status: 404 });
  const staff = isStaffRole(guard.live.user.role);
  if (!staff && query.userId !== guard.live.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = (await request.json()) as { rating?: StudentRating };
  if (body.rating !== 1 && body.rating !== -1) {
    return NextResponse.json({ error: "rating must be 1 or -1." }, { status: 400 });
  }
  const next = await patchMathQuery(id, { rating: body.rating });
  if (body.rating === -1) {
    const { notifyStaff } = await import("@/lib/notifications/store");
    await notifyStaff({
      kind: "solver_issue",
      title: `${guard.live.user.name} reported an AI solution`,
      titleAr: `${guard.live.user.name} بلّغ عن حلّ الذكاء`,
      body: query.question.slice(0, 180),
      bodyAr: query.question.slice(0, 180),
      href: "/admin",
      relatedId: `issue-${id}`,
    });
  }
  return NextResponse.json({ query: next });
}
