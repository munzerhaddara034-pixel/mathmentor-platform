import { NextResponse } from "next/server";
import { nextAdaptiveQuestion, questionsForLesson, sampleExamQuestions } from "@/lib/quizBank";
import { addProgress, addQuizAttempt, readStore } from "@/lib/store";
import { createId } from "@/lib/ids";
import type { Difficulty } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lessonId = url.searchParams.get("lessonId") ?? "";
  const store = await readStore();
  const custom = store.customQuestions ?? [];
  if (url.searchParams.get("pack") === "1") {
    let pack = questionsForLesson(lessonId, custom);
    const examId = url.searchParams.get("examId");
    if (examId) {
      const exam = store.exams.find((item) => item.id === examId);
      if (exam?.questionIds.length) pack = pack.filter((item) => exam.questionIds.includes(item.id));
      return NextResponse.json({ questions: pack, exam });
    }
    const limit = Number(url.searchParams.get("limit") ?? "0");
    if (limit > 0) pack = sampleExamQuestions(pack, limit);
    return NextResponse.json({ questions: pack });
  }
  const used = url.searchParams.get("used")?.split(",").filter(Boolean) ?? [];
  const last = url.searchParams.get("last");
  const difficulty = Number(url.searchParams.get("d") ?? 2) as Difficulty;
  const question = nextAdaptiveQuestion(
    lessonId,
    used,
    last === "1" ? true : last === "0" ? false : undefined,
    difficulty,
    custom,
  );
  return NextResponse.json({
    question,
    remaining: questionsForLesson(lessonId, custom).filter((item) => !used.includes(item.id)).length,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { lessonId?: string; score?: number; studentName?: string; passScore?: number };
  if (!body.lessonId || body.score == null) return NextResponse.json({ error: "Missing quiz result" }, { status: 400 });
  const passScore = body.passScore ?? 70;
  const passed = body.score >= passScore;
  await addQuizAttempt({
    id: createId("quiz"),
    lessonId: body.lessonId,
    studentName: body.studentName || "طالب",
    score: body.score,
    passed,
    points: Math.round(body.score),
    createdAt: new Date().toISOString(),
  });
  await addProgress({
    lessonId: body.lessonId,
    completedAt: new Date().toISOString(),
    score: body.score,
    passedQuiz: passed,
  });
  const store = await readStore();
  return NextResponse.json({ passed, progress: store.progress, attempts: store.quizAttempts.slice(0, 20) });
}
