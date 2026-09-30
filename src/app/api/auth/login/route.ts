import { NextResponse } from "next/server";
import { findUserByEmail as findProfileByEmail } from "@/lib/auth/db";
import { verifyPassword as verifyProfilePassword } from "@/lib/auth/password";
import { ensureUserForProfile, findUserByEmail, asPublicUser, userAccess, type AuthUser } from "@/lib/auth/store";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { startExclusiveSession } from "@/lib/auth/session";
import { deviceClassLabel, deviceDisplayName, type DeviceFingerprint } from "@/lib/auth/device";
import { isSessionSharingExempt, isStaffRole } from "@/lib/auth/paths";

export const runtime = "nodejs";

/**
 * Accounts created through /signup (or the Render demo seed) live in the SQLite profile DB.
 * When the session store does not accept the credentials, try that DB and mirror the account.
 */
async function authenticateViaProfile(email: string, password: string): Promise<AuthUser | null> {
  let profile: Awaited<ReturnType<typeof findProfileByEmail>>;
  try {
    profile = await findProfileByEmail(email);
  } catch {
    return null;
  }
  if (!profile || !verifyProfilePassword(password, profile.passwordHash)) return null;
  return ensureUserForProfile({
    email: profile.user.email,
    name: profile.user.name,
    role: profile.user.role,
    passwordHash: hashPassword(password),
  });
}

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
  const stored = await findUserByEmail(email);
  const user =
    stored && verifyPassword(password, stored.passwordHash) ? stored : await authenticateViaProfile(email, password);
  if (!user) {
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
  const requested = body.next && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : "";
  // Default landing is the role dashboard (student / parent / teacher console); paywalled
  // destinations still route through /redeem or /subscribe when access is missing.
  let redirectTo = requested || "/dashboard";
  if (isStaffRole(user.role)) {
    // Staff keep every destination.
  } else if (
    requested &&
    !requested.startsWith("/dashboard") &&
    !requested.startsWith("/profile") &&
    !access.aiAccess &&
    !access.liveAccess
  ) {
    redirectTo = `/redeem?need=subscription&next=${encodeURIComponent(requested)}`;
  } else if (!isStaffRole(user.role) && requested.startsWith("/live") && !access.liveAccess) {
    redirectTo = `/subscribe?need=live&next=${encodeURIComponent(requested)}`;
  } else if (
    !isStaffRole(user.role) &&
    (requested.startsWith("/math-solver") || requested.startsWith("/lessons") || requested.startsWith("/exams")) &&
    !access.aiAccess
  ) {
    redirectTo = `/redeem?need=ai&next=${encodeURIComponent(requested)}`;
  }
  const described = deviceDisplayName(started.session.userAgent, started.deviceClass);
  const label = deviceClassLabel(started.deviceClass);
  const staffLogin = started.sharingExempt || isSessionSharingExempt(user);
  const notice = staffLogin
    ? `Signed in on ${described.nameWithClass}. Teacher/admin accounts stay signed in on other devices; a notification named this device.`
    : started.replaced
      ? `This sign-in closed the previous ${label.en} session. One mobile and one desktop session may stay active.`
      : "Signed in. This account allows 1 mobile and 1 desktop session at a time.";
  const noticeAr = staffLogin
    ? `تم الدخول من ${described.nameWithClassAr}. حسابات الأستاذ والإدارة تبقى مفتوحة على الأجهزة الأخرى؛ أُرسل تنبيه باسم هذا الجهاز.`
    : started.replaced
      ? `أغلق هذا الدخول جلسة ${label.ar} السابقة. يُسمح بجلسة هاتف واحدة وجلسة حاسوب واحدة معاً.`
      : "تم الدخول. يُسمح بجلسة هاتف واحدة وجلسة حاسوب واحدة في الوقت نفسه.";
  return NextResponse.json({
    ok: true,
    user: publicUser,
    redirectTo,
    deviceClass: started.deviceClass,
    deviceName: described.nameWithClass,
    replaced: started.replaced,
    sharingExempt: staffLogin,
    notice,
    noticeAr,
  });
}
