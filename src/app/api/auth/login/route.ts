import { NextResponse } from "next/server";
import { findUserByEmail, asPublicUser, userAccess } from "@/lib/auth/store";
import { verifyPassword } from "@/lib/auth/passwords";
import { startExclusiveSession } from "@/lib/auth/session";
import { deviceClassLabel, type DeviceFingerprint } from "@/lib/auth/device";
import { isStaffRole } from "@/lib/auth/paths";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    email?: string;
    password?: string;
    next?: string;
    fingerprint?: DeviceFingerprint;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON.", errorAr: "JSON غير صالح." },
      { status: 400 },
    );
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required.", errorAr: "البريد وكلمة المرور مطلوبان." },
      { status: 400 },
    );
  }
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      {
        error: "Wrong email or password.",
        errorAr: "البريد أو كلمة المرور غير صحيحة.",
      },
      { status: 401 },
    );
  }
  const ua = request.headers.get("user-agent") ?? undefined;
  const started = await startExclusiveSession(user.id, body.fingerprint?.userAgent || ua, body.fingerprint);
  const publicUser = asPublicUser(user);
  const access = await userAccess(user);
  const requested = body.next && body.next.startsWith("/") ? body.next : "";
  let redirectTo = requested || (access.aiAccess ? "/lessons/interactive" : access.liveAccess ? "/live" : "/redeem");
  if (isStaffRole(user.role) && (!requested || requested === "/lessons/interactive")) {
    redirectTo = requested || "/studio/script";
  } else if (!isStaffRole(user.role) && !access.aiAccess && !access.liveAccess) {
    redirectTo = `/redeem?need=subscription${requested ? `&next=${encodeURIComponent(requested)}` : ""}`;
  } else if (!isStaffRole(user.role) && requested.startsWith("/live") && !access.liveAccess) {
    redirectTo = `/subscribe?need=live&next=${encodeURIComponent(requested)}`;
  } else if (
    !isStaffRole(user.role) &&
    (requested.startsWith("/math-solver") || requested.startsWith("/lessons") || requested.startsWith("/exams")) &&
    !access.aiAccess
  ) {
    redirectTo = `/redeem?need=ai&next=${encodeURIComponent(requested)}`;
  }
  const label = deviceClassLabel(started.deviceClass);
  const notice = started.replaced
    ? `This sign-in closed the previous ${label.en} session. One mobile and one desktop session may stay active.`
    : "Signed in. This account allows 1 mobile and 1 desktop session at a time.";
  const noticeAr = started.replaced
    ? `أغلق هذا الدخول جلسة ${label.ar} السابقة. يُسمح بجلسة هاتف واحدة وجلسة حاسوب واحدة معاً.`
    : "تم الدخول. يُسمح بجلسة هاتف واحدة وجلسة حاسوب واحدة في الوقت نفسه.";
  return NextResponse.json({
    ok: true,
    user: publicUser,
    redirectTo,
    deviceClass: started.deviceClass,
    replaced: started.replaced,
    notice,
    noticeAr,
  });
}
