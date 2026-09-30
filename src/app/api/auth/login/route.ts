import { NextResponse } from "next/server";
import { findUserByEmail as findProfileByEmail } from "@/lib/auth/db";
import { verifyPassword as verifyProfilePassword } from "@/lib/auth/password";
import {
  ensureAdminRoleForAllowlistedEmail,
  ensureUserForProfile,
  findUserByEmail,
  asPublicUser,
  isEmailVerified,
  isLegacyAccount,
  userAccess,
  verifyEmailForUser,
  type AuthUser,
} from "@/lib/auth/store";
import { sendVerificationEmail } from "@/lib/auth/sendVerification";
import { authRateLimits, clientIpFrom, tooManyRequestsBody } from "@/lib/security/rateLimit";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { startExclusiveSession } from "@/lib/auth/session";
import { deviceClassLabel, deviceDisplayName, type DeviceFingerprint } from "@/lib/auth/device";
import { isSessionSharingExempt, isStaffRole } from "@/lib/auth/paths";

export const runtime = "nodejs";

/**
 * Accounts created through /signup also live in the profile DB (SQLite or Postgres).
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

function limited(retryAfterSec: number) {
  return NextResponse.json(tooManyRequestsBody(retryAfterSec), {
    status: 429,
    headers: { "Retry-After": String(retryAfterSec) },
  });
}

export async function POST(request: Request) {
  const ipLimit = authRateLimits.loginIp.hit(clientIpFrom(request.headers));
  if (!ipLimit.ok) return limited(ipLimit.retryAfterSec);
  let body: {
    email?: string;
    password?: string;
    next?: string;
    fingerprint?: DeviceFingerprint;
    /** Token from the confirmation e-mail link (/login?verify=…). */
    verifyToken?: string;
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
  const emailKey = `login:${email}`;
  const emailLimit = authRateLimits.loginEmailFailures.check(emailKey);
  if (!emailLimit.ok) return limited(emailLimit.retryAfterSec);

  const stored = await findUserByEmail(email);
  let authenticated: AuthUser | null = null;
  if (stored && verifyPassword(password, stored.passwordHash)) {
    authenticated = stored;
  } else if (!stored || isLegacyAccount(stored)) {
    // Profile-DB fallback only for accounts that predate e-mail verification (or exist only in the
    // profile DB). New accounts always carry their password in the session store.
    authenticated = await authenticateViaProfile(email, password);
  }

  if (authenticated && !isEmailVerified(authenticated)) {
    const token = body.verifyToken?.trim() || "";
    const verified = token ? await verifyEmailForUser(authenticated.id, token) : null;
    if (verified?.ok) {
      authenticated = verified.user;
    } else {
      authRateLimits.loginEmailFailures.reset(emailKey);
      let resent = false;
      try {
        resent = (await sendVerificationEmail(authenticated.id, request.url)).sent;
      } catch {
        resent = false;
      }
      const expired = verified && !verified.ok && verified.reason === "expired";
      return NextResponse.json(
        {
          ok: false,
          needsVerification: true,
          resent,
          error: expired
            ? "This confirmation link expired. We sent a new one if possible — check your inbox."
            : "Confirm your email first: open the link we sent you, then sign in again.",
          errorAr: expired
            ? "انتهت صلاحية رابط التأكيد. أرسلنا رابطاً جديداً إن أمكن — تحقّق من بريدك."
            : resent
              ? "يجب تأكيد بريدك أولاً. أرسلنا لك رابط تأكيد جديداً — افتحه ثم سجّل الدخول."
              : "يجب تأكيد بريدك أولاً: افتح رابط التأكيد المرسل إليك ثم سجّل الدخول مجدداً.",
        },
        { status: 403 },
      );
    }
  }

  // ADMIN_EMAILS allowlist: an existing, verified account on the list is (re)granted admin at login.
  const user = authenticated ? ((await ensureAdminRoleForAllowlistedEmail(authenticated.id)) ?? authenticated) : null;
  if (!user) {
    authRateLimits.loginEmailFailures.hit(emailKey);
    return NextResponse.json(
      {
        error: "Wrong email or password.",
        errorAr: "البريد أو كلمة المرور غير صحيحة.",
      },
      { status: 401 },
    );
  }
  authRateLimits.loginEmailFailures.reset(emailKey);
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
