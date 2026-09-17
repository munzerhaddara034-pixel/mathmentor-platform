import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";

export async function authorizeJobsRequest(request: Request) {
  const secret = process.env.JOBS_SECRET?.trim();
  const provided =
    request.headers.get("x-jobs-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    new URL(request.url).searchParams.get("secret")?.trim() ||
    "";

  if (secret) {
    if (provided === secret) return { ok: true as const, mode: "secret" as const };
    const guard = await apiSession();
    if (!guard.error && isStaffRole(guard.live.user.role)) {
      return { ok: true as const, mode: "staff" as const };
    }
    return {
      ok: false as const,
      error: NextResponse.json({ error: "JOBS_SECRET or staff session required." }, { status: 401 }),
    };
  }

  const guard = await apiSession();
  if (!guard.error && isStaffRole(guard.live.user.role)) {
    return { ok: true as const, mode: "staff" as const };
  }
  // Demo: empty JOBS_SECRET allows the scheduled POST so local/Netlify QA works without keys.
  return { ok: true as const, mode: "demo" as const };
}
