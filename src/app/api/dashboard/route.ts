import { NextResponse } from "next/server";
import { activationCodeValueUsd } from "@/lib/pricing/plans";
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
  const usedCardList = store.scratchCards.filter((item) => item.used);
  const usedCards = usedCardList.length;
  // Card value = matching regional plan price from plans.ts (single price source), not a hard-coded 39.
  const cardRevenueUsd = usedCardList.reduce((sum, card) => sum + activationCodeValueUsd(card.planId), 0);
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
      // Only priced items (activation codes valued from plans.ts). The old "$5 per lesson viewed" guess is gone.
      estimatedUsd: cardRevenueUsd,
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
