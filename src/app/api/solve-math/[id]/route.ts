import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { getMathQuery } from "@/lib/solver";

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
