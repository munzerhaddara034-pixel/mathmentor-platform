import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { monthlyLeaderboard } from "@/lib/gamification/store";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const rows = await monthlyLeaderboard();
  return NextResponse.json({ month: new Date().toISOString().slice(0, 7), rows });
}
