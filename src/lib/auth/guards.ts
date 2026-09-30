import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getLiveSession, type LiveSession } from "./session";
import { isStaffRole, loginUrl } from "./paths";
import { userHasAiAccess, userHasLiveAccess, userHasSubscription } from "./store";

export async function requireAuth(nextPath: string) {
  const live = await getLiveSession();
  if (!live.ok) {
    redirect(loginUrl(nextPath, live.reason === "replaced" || live.reason === "expired" ? live.reason : undefined));
  }
  if (!live.ok) throw new Error("unreachable");
  return live;
}

export async function requireStaff(nextPath: string) {
  const live = await requireAuth(nextPath);
  if (!isStaffRole(live.user.role)) {
    redirect("/lessons/interactive");
  }
  return live;
}

export async function requireLessonAccess(nextPath: string) {
  const live = await requireAuth(nextPath);
  if (isStaffRole(live.user.role)) return live;
  const subscribed = await userHasSubscription(live.user);
  if (!subscribed) redirect(`/redeem?need=subscription&next=${encodeURIComponent(nextPath)}`);
  return live;
}

export async function requireAiAccess(nextPath: string) {
  const live = await requireAuth(nextPath);
  if (isStaffRole(live.user.role)) return live;
  const allowed = await userHasAiAccess(live.user);
  if (!allowed) redirect(`/redeem?need=ai&next=${encodeURIComponent(nextPath)}`);
  return live;
}

export async function requireLiveAccess(nextPath: string) {
  const live = await requireAuth(nextPath);
  if (isStaffRole(live.user.role)) return live;
  const allowed = await userHasLiveAccess(live.user);
  if (!allowed) redirect(`/subscribe?need=live&next=${encodeURIComponent(nextPath)}`);
  return live;
}

export async function apiSession(): Promise<
  | { live: Extract<LiveSession, { ok: true }>; error: null }
  | { live: Extract<LiveSession, { ok: false }>; error: NextResponse }
> {
  const live = await getLiveSession();
  if (!live.ok) {
    const body = {
      ok: false as const,
      reason: live.reason,
      error:
        live.reason === "replaced"
          ? "Signed in on another device. Please log in again."
          : "Sign in required.",
      errorAr:
        live.reason === "replaced"
          ? "تم تسجيل الدخول من جهاز آخر. يرجى تسجيل الدخول مجدداً."
          : "يلزم تسجيل الدخول.",
    };
    return { live, error: NextResponse.json(body, { status: 401 }) };
  }
  return { live, error: null };
}

export async function apiRequireAiAccess(): Promise<
  | { live: Extract<LiveSession, { ok: true }>; error: null }
  | { live: Extract<LiveSession, { ok: false }> | Extract<LiveSession, { ok: true }>; error: NextResponse }
> {
  const guard = await apiSession();
  if (guard.error) return guard;
  const user = guard.live.user;
  if (isStaffRole(user.role)) return { live: guard.live, error: null };
  if (await userHasAiAccess(user)) return { live: guard.live, error: null };
  return {
    live: guard.live,
    error: NextResponse.json(
      {
        ok: false as const,
        error: "AI_TIER or BOTH subscription required.",
        errorAr: "يلزم اشتراك الذكاء الاصطناعي.",
        need: "ai",
      },
      { status: 403 },
    ),
  };
}


type OkLive = Extract<LiveSession, { ok: true }>;

/** API guard: signed-in teacher/admin (staff). */
export async function apiRequireStaff(): Promise<{ live: OkLive; error: null } | { live: null; error: NextResponse }> {
  const guard = await apiSession();
  if (guard.error) return { live: null, error: guard.error };
  if (!isStaffRole(guard.live.user.role)) {
    return {
      live: null,
      error: NextResponse.json({ ok: false, error: "Staff only.", errorAr: "للطاقم فقط." }, { status: 403 }),
    };
  }
  return { live: guard.live, error: null };
}

/**
 * API guard for destructive operations: admin role only (ADMIN_EMAILS + verified e-mail).
 * Teachers are staff but cannot delete.
 */
export async function apiRequireAdmin(): Promise<{ live: OkLive; error: null } | { live: null; error: NextResponse }> {
  const guard = await apiSession();
  if (guard.error) return { live: null, error: guard.error };
  if (guard.live.user.role !== "admin" || !guard.live.user.emailVerified) {
    return {
      live: null,
      error: NextResponse.json(
        { ok: false, error: "Admin only (destructive action).", errorAr: "للإدارة فقط (عملية حذف)." },
        { status: 403 },
      ),
    };
  }
  return { live: guard.live, error: null };
}
