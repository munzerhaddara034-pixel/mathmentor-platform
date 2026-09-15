import { NextResponse } from "next/server";
import { addExam, readStore } from "@/lib/store";
import { createId } from "@/lib/ids";
import type { GradeTrack } from "@/lib/types";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ exams: store.exams });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    arabicTitle?: string;
    track?: GradeTrack;
    lessonId?: string;
    questionIds?: string[];
    durationMinutes?: number;
    passScore?: number;
  };
  if (!body.title) return NextResponse.json({ error: "عنوان الاختبار مطلوب" }, { status: 400 });
  const exam = await addExam({
    id: createId("exam"),
    title: body.title,
    arabicTitle: body.arabicTitle || body.title,
    track: body.track,
    lessonId: body.lessonId,
    questionIds: body.questionIds ?? [],
    durationMinutes: body.durationMinutes ?? 15,
    passScore: body.passScore ?? 70,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ exam });
}
