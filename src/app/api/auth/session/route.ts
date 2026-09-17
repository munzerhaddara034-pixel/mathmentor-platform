import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/auth/session";
import { listUserSessions, userAccess } from "@/lib/auth/store";
import { isStaffRole } from "@/lib/auth/paths";

export const runtime = "nodejs";

export async function GET() {
  const live = await getLiveSession();
  if (!live.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: live.reason,
        error:
          live.reason === "replaced"
            ? "Signed in on another device of the same type. Please log in again."
            : "Sign in required.",
        errorAr:
          live.reason === "replaced"
            ? "تم تسجيل الدخول من جهاز آخر من النوع نفسه. يرجى تسجيل الدخول مجدداً."
            : "يلزم تسجيل الدخول.",
      },
      { status: 401 },
    );
  }
  const access = isStaffRole(live.user.role)
    ? {
        aiAccess: true,
        liveAccess: true,
        subscribed: true,
        subscriptionType: live.user.subscriptionType,
        liveCredits: live.user.liveCredits,
      }
    : await userAccess(live.user);
  const devices = await listUserSessions(live.user.id);
  return NextResponse.json({
    ok: true,
    user: live.user,
    subscribed: access.aiAccess,
    aiAccess: access.aiAccess,
    liveAccess: access.liveAccess,
    subscriptionType: access.subscriptionType,
    liveCredits: access.liveCredits,
    aiExpiresAt: live.user.aiExpiresAt,
    canTeach: isStaffRole(live.user.role),
    sessionId: live.sessionId,
    devices: devices.map((device) => ({
      ...device,
      current: device.id === live.sessionId,
    })),
  });
}
