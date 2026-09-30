import { walletSnapshot } from "@/lib/billing/store";
import { BADGE_META, getProfile } from "@/lib/gamification/store";
import { listBookings } from "@/lib/live/store";
import type { BookingStatus } from "@/lib/live/types";
import type { SubscriptionType } from "@/lib/auth/tiers";

type OverviewSubject = { id: string; name: string };

export type OverviewPlan = {
  subscriptionType: SubscriptionType | null;
  aiStatus: "none" | "active" | "expired";
  aiExpiresAt: string | null;
  liveCredits: number;
};

export type OverviewSession = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  status: BookingStatus;
  /** Only exposed once the booking is confirmed. */
  classroomUrl: string | null;
};

export type OverviewStreak = {
  streakDays: number;
  lastActivityDate: string;
  xp: number;
  badges: { id: string; title: string; titleAr: string }[];
};

export type StudentOverview = {
  plan: OverviewPlan | null;
  nextSession: OverviewSession | null;
  streak: OverviewStreak | null;
  /** Sources that failed to load (the rest of the payload is still valid). */
  unavailable: ("plan" | "sessions" | "streak")[];
};

const OPEN_STATUSES: ReadonlySet<BookingStatus> = new Set(["requested", "pending_payment", "confirmed"]);

function toAiStatus(value: string): OverviewPlan["aiStatus"] {
  return value === "active" || value === "expired" ? value : "none";
}

async function loadPlan(userId: string): Promise<OverviewPlan | null> {
  const snapshot = await walletSnapshot(userId);
  if (!snapshot) return null;
  return {
    subscriptionType: snapshot.subscriptionType,
    aiStatus: toAiStatus(snapshot.aiStatus),
    aiExpiresAt: snapshot.aiExpiresAt,
    liveCredits: snapshot.liveCredits,
  };
}

async function loadNextSession(userId: string, now: number): Promise<OverviewSession | null> {
  const bookings = await listBookings({ studentId: userId });
  const upcoming = bookings
    .filter((item) => OPEN_STATUSES.has(item.status))
    .filter((item) => Date.parse(item.startsAt) + item.durationMinutes * 60_000 > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  if (!next) return null;
  return {
    id: next.id,
    startsAt: next.startsAt,
    durationMinutes: next.durationMinutes,
    status: next.status,
    classroomUrl: next.status === "confirmed" ? next.classroomUrl ?? next.meetingLink ?? null : null,
  };
}

async function loadStreak(user: OverviewSubject): Promise<OverviewStreak> {
  const profile = await getProfile(user.id, user.name);
  return {
    streakDays: profile.streakDays,
    lastActivityDate: profile.lastActivityDate,
    xp: profile.xp,
    badges: profile.badges.map((id) => ({ id, title: BADGE_META[id]?.title ?? id, titleAr: BADGE_META[id]?.titleAr ?? id })),
  };
}

/** Aggregates the student dashboard widgets; each source fails independently. */
export async function buildStudentOverview(user: OverviewSubject): Promise<StudentOverview> {
  const unavailable: StudentOverview["unavailable"] = [];
  const [plan, nextSession, streak] = await Promise.all([
    loadPlan(user.id).catch((error: unknown) => {
      console.warn("overview: wallet unavailable", error);
      unavailable.push("plan");
      return null;
    }),
    loadNextSession(user.id, Date.now()).catch((error: unknown) => {
      console.warn("overview: bookings unavailable", error);
      unavailable.push("sessions");
      return null;
    }),
    loadStreak(user).catch((error: unknown) => {
      console.warn("overview: gamification unavailable", error);
      unavailable.push("streak");
      return null;
    }),
  ]);
  return { plan, nextSession, streak, unavailable };
}
