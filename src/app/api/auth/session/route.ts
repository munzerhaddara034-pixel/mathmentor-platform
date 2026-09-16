import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/auth/session";
import { userHasSubscription } from "@/lib/auth/store";
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
            ? "Signed in on another device. Please log in again."
            : "Sign in required.",
        errorAr:
          live.reason === "replaced"
            ? "تم تسجيل الدخول من جهاز آخر. يرجى تسجيل الدخول مجدداً."
            : "يلزم تسجيل الدخول.",
      },
      { status: 401 },
    );
  }
  const subscribed = isStaffRole(live.user.role) ? true : await userHasSubscription(live.user);
  return NextResponse.json({
    ok: true,
    user: live.user,
    subscribed,
    canTeach: isStaffRole(live.user.role),
  });
}
