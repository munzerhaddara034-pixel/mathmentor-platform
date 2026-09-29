import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { listPublicUsers } from "@/lib/auth/store";
import { accessFromSubscription } from "@/lib/auth/tiers";
import { listMathQueries } from "@/lib/solver";
import { listBookings } from "@/lib/live/store";
import { beirutDayKey, startOfBeirutWeek } from "@/lib/live/timezone";
import { readStore } from "@/lib/store";
import { listHeyGenJobs } from "@/lib/studio/heygenJobs";
import { listWhatsAppMessages } from "@/lib/whatsapp/store";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const [users, queries, bookings, store, jobs, whatsapp] = await Promise.all([
    listPublicUsers(),
    listMathQueries({ limit: 300 }),
    listBookings(),
    readStore(),
    listHeyGenJobs(),
    listWhatsAppMessages(80),
  ]);

  const students = users.filter((user) => user.role === "student" || user.role === "parent");
  const activations = store.entitlements ?? [];
  const active = students.filter((user) => accessFromSubscription(user.role, user.subscriptionType, user.liveCredits).aiAccess || accessFromSubscription(user.role, user.subscriptionType, user.liveCredits).liveAccess);

  const byType = { AI_TIER: 0, LIVE_TIER: 0, BOTH: 0, EXPIRED: 0, none: 0 };
  for (const user of students) {
    const key = user.subscriptionType && user.subscriptionType !== "EXPIRED" ? user.subscriptionType : user.entitlementPlanId ? "AI_TIER" : "none";
    byType[key as keyof typeof byType] += 1;
  }

  const todayKey = beirutDayKey();
  const weekStart = startOfBeirutWeek().getTime();
  const answeredToday = queries.filter((item) => !item.needsRetake && beirutDayKey(item.createdAt) === todayKey).length;
  const liveThisWeek = bookings.filter((item) => item.status !== "cancelled" && Date.parse(item.createdAt) >= weekStart).length;
  const topicMap = new Map<string, { tag: string; count: number; down: number }>();
  for (const query of queries) {
    if (query.needsRetake) continue;
    const tag = query.topicTag || "general";
    const cur = topicMap.get(tag) ?? { tag, count: 0, down: 0 };
    cur.count += 1;
    if (query.rating === -1) cur.down += 1;
    topicMap.set(tag, cur);
  }
  const hardestTopics = [...topicMap.values()].sort((a, b) => b.down - a.down || b.count - a.count).slice(0, 5);

  return NextResponse.json({
    analytics: {
      students: students.length,
      activeSubscriptions: active.length,
      activations: activations.length,
      byType,
      aiQueries: queries.length,
      questionsToday: answeredToday,
      liveBookings: bookings.length,
      liveRequested: bookings.filter((item) => item.status === "requested").length,
      liveThisWeek,
      videoJobs: jobs.length,
      hardestTopics,
    },
    users: students,
    entitlements: activations.slice(0, 40),
    queries: queries.slice(0, 80),
    bookings: bookings.slice(0, 80),
    jobs: jobs.slice(0, 40),
    whatsapp,
  });
}
