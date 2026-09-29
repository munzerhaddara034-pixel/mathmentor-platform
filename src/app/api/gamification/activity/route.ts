import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { recordActivity, type ActivityKind } from "@/lib/gamification/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const body = (await request.json()) as {
    kind?: ActivityKind;
    topic?: string;
    examPercent?: number;
    examTrack?: string;
    lessonId?: string;
  };
  const kind = body.kind;
  if (kind !== "lesson" && kind !== "solver" && kind !== "exam" && kind !== "quiz") {
    return NextResponse.json({ error: "kind required." }, { status: 400 });
  }
  const result = await recordActivity({
    userId: guard.live.user.id,
    name: guard.live.user.name,
    kind,
    topic: body.topic,
    examPercent: body.examPercent,
    examTrack: body.examTrack,
    lessonId: body.lessonId,
  });
  return NextResponse.json({ ok: true, ...result });
}
