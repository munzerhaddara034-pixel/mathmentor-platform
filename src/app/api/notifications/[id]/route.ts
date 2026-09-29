import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { markRead } from "@/lib/notifications/store";

export const runtime = "nodejs";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const { id } = await context.params;
  const item = await markRead(id, guard.live.user.id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, notification: item });
}
