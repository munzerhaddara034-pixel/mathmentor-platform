import { NextResponse } from "next/server";
import { academyLessons } from "@/lib/academyLessons";
import { requireRole } from "@/lib/auth/server";
import { readStore } from "@/lib/store";
import { promoStats } from "@/lib/auth/entitlements";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const store = await readStore();
  const cards = promoStats();
  const passed = store.progress.filter((item) => item.passedQuiz).length;
  const views = academyLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    views: store.progress.filter((item) => item.lessonId === lesson.id).length + store.quizAttempts.filter((item) => item.lessonId === lesson.id).length,
  }));
  views.sort((a, b) => b.views - a.views);
  const avg = store.quizAttempts.length
    ? Math.round(store.quizAttempts.reduce((sum, item) => sum + item.score, 0) / store.quizAttempts.length)
    : 0;
  return NextResponse.json({
    subscribers: new Set(store.quizAttempts.map((item) => item.studentName)).size + cards.used,
    videosTop: views.slice(0, 8),
    examAverage: avg,
    cardsSold: cards.used,
    cardsLeft: cards.unused,
    passedLessons: passed,
    financials: {
      estimatedUsd: cards.used * 39 + store.progress.length * 5,
      currency: "USD",
    },
    attempts: store.quizAttempts.slice(0, 12),
  });
}
