import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { buildStudentOverview } from "@/lib/dashboard/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Student dashboard widgets (plan, next live session, streak). Signed-in users only; own data only. */
export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  try {
    return NextResponse.json({ ok: true, overview: await buildStudentOverview(guard.live.user) });
  } catch (error) {
    console.warn("me/overview failed", error);
    return NextResponse.json(
      { ok: false, error: "Overview unavailable.", errorAr: "تعذّر تحميل ملخّص حسابك الآن." },
      { status: 500 },
    );
  }
}
