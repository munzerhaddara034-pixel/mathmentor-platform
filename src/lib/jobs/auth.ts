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
  // Fail closed in production: this endpoint sends WhatsApp messages, so an anonymous caller could
  // otherwise trigger real messages and cost. Local/QA keeps the keyless path; a deployment that
  // cannot set JOBS_SECRET can opt in explicitly with JOBS_ALLOW_UNSIGNED=1.
  if (process.env.NODE_ENV === "production" && process.env.JOBS_ALLOW_UNSIGNED !== "1") {
    console.warn("[mathmentor] jobs: JOBS_SECRET is not set — refusing an unauthenticated job run");
    return {
      ok: false as const,
      error: NextResponse.json({ error: "JOBS_SECRET or staff session required." }, { status: 401 }),
    };
  }
  return { ok: true as const, mode: "demo" as const };
}
