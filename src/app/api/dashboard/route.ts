import { NextResponse } from "next/server";
import { academyLessons } from "@/lib/academyLessons";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { listUserSessions } from "@/lib/auth/store";
import { listNotifications } from "@/lib/notifications/store";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only.", errorAr: "للأستاذ والإدارة فقط." }, { status: 403 });
  }

  const store = await readStore();
  const views = academyLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    views: store.progress.filter((item) => item.lessonId === lesson.id).length + store.quizAttempts.filter((item) => item.lessonId === lesson.id).length,
  }));
  views.sort((a, b) => b.views - a.views);
  const avg = store.quizAttempts.length
    ? Math.round(store.quizAttempts.reduce((sum, item) => item.score + sum, 0) / store.quizAttempts.length)
    : 0;
  const usedCards = store.scratchCards.filter((item) => item.used).length;
  const devices = await listUserSessions(guard.live.user.id);
  const notifications = await listNotifications(guard.live.user.id);
  const deviceAlerts = notifications.filter((item) => item.kind === "device_login").slice(0, 12);

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
    devices: devices.map((device) => ({
      ...device,
      current: device.id === guard.live.sessionId,
    })),
    deviceAlerts,
  });
}
