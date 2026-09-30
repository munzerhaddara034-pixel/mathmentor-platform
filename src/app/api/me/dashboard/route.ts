import { NextResponse } from "next/server";
import { buildRoleDashboard } from "@/lib/auth/dashboard";
import { requireSession } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET() {
  const result = await requireSession();
  if (!result.ok) return result.error;
  try {
    return NextResponse.json(await buildRoleDashboard(result.user));
  } catch (error) {
    console.warn("me/dashboard: profile DB unavailable", error);
    return NextResponse.json({ user: result.user, linkedStudent: null, courses: [], reminders: [] });
  }
}
