import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { getProfile, monthlyLeaderboard } from "@/lib/gamification/store";
import { BADGE_META } from "@/lib/gamification/store";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const profile = await getProfile(guard.live.user.id, guard.live.user.name);
  const leaderboard = await monthlyLeaderboard();
  return NextResponse.json({
    profile,
    badges: profile.badges.map((id) => ({ id, ...BADGE_META[id] })),
    leaderboard,
  });
}
