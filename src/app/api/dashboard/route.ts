import { NextResponse } from "next/server";
import { academyLessons } from "@/lib/academyLessons";
import { readStore } from "@/lib/store";

export async function GET() {
  const store = await readStore();
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
  const usedCards = store.scratchCards.filter((item) => item.used).length;
  return NextResponse.json({
    subscribers: new Set(store.quizAttempts.map((item) => item.studentName)).size + usedCards,
    videosTop: views.slice(0, 8),
    examAverage: avg,
    cardsSold: usedCards,
    cardsLeft: store.scratchCards.filter((item) => !item.used).length,
    financials: {
      estimatedUsd: usedCards * 39 + store.progress.length * 5,
      currency: "USD",
    },
    attempts: store.quizAttempts.slice(0, 12),
  });
}
