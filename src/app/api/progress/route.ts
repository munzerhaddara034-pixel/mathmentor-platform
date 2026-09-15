import { NextResponse } from "next/server";
import { addProgress, readStore } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { lessonId?: string };
  if (!body.lessonId) return NextResponse.json({ error: "Missing lesson" }, { status: 400 });
  const progress = await addProgress({ lessonId: body.lessonId, completedAt: new Date().toISOString() });
  const store = await readStore();
  return NextResponse.json({ progress, settings: store.settings });
}
