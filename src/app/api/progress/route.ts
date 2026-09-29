import { NextResponse } from "next/server";
import { addProgress, readStore } from "@/lib/store";
import { getLiveSession } from "@/lib/auth/session";
import { recordActivity } from "@/lib/gamification/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { lessonId?: string };
  if (!body.lessonId) return NextResponse.json({ error: "Missing lesson" }, { status: 400 });
  const progress = await addProgress({ lessonId: body.lessonId, completedAt: new Date().toISOString() });
  const live = await getLiveSession();
  if (live.ok) {
    await recordActivity({ userId: live.user.id, name: live.user.name, kind: "lesson", lessonId: body.lessonId });
  }
  const store = await readStore();
  return NextResponse.json({ progress, settings: store.settings });
}
