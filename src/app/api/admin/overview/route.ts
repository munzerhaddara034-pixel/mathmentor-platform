import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { listPublicUsers } from "@/lib/auth/store";
import { accessFromSubscription } from "@/lib/auth/tiers";
import { listMathQueries } from "@/lib/solver";
import { listBookings } from "@/lib/live/store";
import { readStore } from "@/lib/store";
import { listHeyGenJobs } from "@/lib/studio/heygenJobs";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const [users, queries, bookings, store, jobs] = await Promise.all([
    listPublicUsers(),
    listMathQueries({ limit: 300 }),
    listBookings(),
    readStore(),
    listHeyGenJobs(),
  ]);

  const students = users.filter((user) => user.role === "student" || user.role === "parent");
  const activations = store.entitlements ?? [];
  const active = students.filter((user) => accessFromSubscription(user.role, user.subscriptionType, user.liveCredits).aiAccess || accessFromSubscription(user.role, user.subscriptionType, user.liveCredits).liveAccess);

  const byType = { AI_TIER: 0, LIVE_TIER: 0, BOTH: 0, EXPIRED: 0, none: 0 };
  for (const user of students) {
    const key = user.subscriptionType && user.subscriptionType !== "EXPIRED" ? user.subscriptionType : user.entitlementPlanId ? "AI_TIER" : "none";
    byType[key as keyof typeof byType] += 1;
  }

  return NextResponse.json({
    analytics: {
      students: students.length,
      activeSubscriptions: active.length,
      activations: activations.length,
      byType,
      aiQueries: queries.length,
      liveBookings: bookings.length,
      liveRequested: bookings.filter((item) => item.status === "requested").length,
      videoJobs: jobs.length,
    },
    users: students,
    entitlements: activations.slice(0, 40),
    queries: queries.slice(0, 80),
    bookings: bookings.slice(0, 80),
    jobs: jobs.slice(0, 40),
  });
}
