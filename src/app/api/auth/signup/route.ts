import { NextResponse } from "next/server";
import { createUser } from "@/lib/auth/db";
import { checkSignupPassword } from "@/lib/auth/passwordPolicy";
import { hashPassword } from "@/lib/auth/passwords";
import { sendVerificationEmail } from "@/lib/auth/sendVerification";
import { ensureUserForProfile, findUserByEmail, isEmailVerified, replacePendingSignup } from "@/lib/auth/store";
import { isUserRole, type UserRole } from "@/lib/auth/types";
import { authRateLimits, clientIpFrom, tooManyRequestsBody } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

/**
 * Teacher / admin accounts carry staff powers (Agent Hub, codes, approvals). They are never chosen in
 * the form: only an email on the ADMIN_EMAILS allowlist becomes admin — and only after that address
 * is verified (the confirmation link + password at login). Everyone else is student/parent.
 *
 * New accounts get no session here: the user must open the e-mailed link and sign in.
 */
const SELF_SIGNUP_ROLES: UserRole[] = ["student", "parent"];

function verificationResponse(emailSent: boolean) {
  return NextResponse.json({
    ok: true,
    verificationRequired: true,
    emailSent,
    message: emailSent
      ? "أرسلنا رابط التأكيد إلى بريدك. افتحه ثم سجّل الدخول لتفعيل الحساب."
      : "أُنشئ الحساب لكن تعذّر إرسال رسالة التأكيد الآن. سجّل الدخول لاحقاً ليُعاد إرسال الرابط.",
    messageEn: emailSent
      ? "We sent a confirmation link to your email. Open it and sign in to activate your account."
      : "Account created, but the confirmation email could not be sent right now. Sign in later to get a new link.",
  });
}

async function sendLink(userId: string, requestUrl: string) {
  try {
    return (await sendVerificationEmail(userId, requestUrl, { force: true })).sent;
  } catch (error) {
    console.warn("signup: verification e-mail failed", error instanceof Error ? error.message : error);
    return false;
  }
}

export async function POST(request: Request) {
  const ipLimit = authRateLimits.signupIp.hit(clientIpFrom(request.headers));
  if (!ipLimit.ok) {
    const limited = tooManyRequestsBody(ipLimit.retryAfterSec);
    return NextResponse.json(
      { ...limited, error: limited.errorAr, errorEn: limited.error },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } },
    );
  }
  let body: {
    email?: string;
    name?: string;
    password?: string;
    role?: string;
    track?: string;
    linkedStudentEmail?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  const password = body.password ?? "";
  const role = body.role ?? "student";
  if (!email || !name || !password) {
    return NextResponse.json({ error: "الاسم والبريد وكلمة المرور مطلوبة" }, { status: 400 });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "أدخل بريداً إلكترونياً صالحاً" }, { status: 400 });
  }
  const passwordCheck = checkSignupPassword(password);
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.errorAr, errorEn: passwordCheck.error }, { status: 400 });
  }
  if (!isUserRole(role)) {
    return NextResponse.json({ error: "اختر دوراً صالحاً" }, { status: 400 });
  }
  if (!SELF_SIGNUP_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "حسابات الأستاذ والإدارة تُنشأ من الإدارة فقط. سجّل كطالب أو ولي أمر." },
      { status: 403 },
    );
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    if (isEmailVerified(existing)) {
      return NextResponse.json({ error: "هذا البريد مسجّل مسبقاً" }, { status: 400 });
    }
    // Never-verified account (possibly a squatter): the new signup replaces it; only the inbox
    // owner receives the link, and the link only works together with the new password.
    const replaced = await replacePendingSignup(existing.id, { name, passwordHash: hashPassword(password), role });
    if (!replaced) return NextResponse.json({ error: "هذا البريد مسجّل مسبقاً" }, { status: 400 });
    // Profile row may be missing if the first attempt failed validation; "already exists" is fine.
    await createUser({
      email,
      name,
      password,
      role,
      track: body.track || (role === "student" ? "grade-12" : null),
      linkedStudentEmail: body.linkedStudentEmail,
    }).catch(() => undefined);
    return verificationResponse(await sendLink(replaced.id, request.url));
  }

  // Session-store record first (pending verification), so a profile row never exists without it
  // (login mirrors profile-only rows as legacy accounts).
  const user = await ensureUserForProfile({
    email,
    name,
    role,
    passwordHash: hashPassword(password),
    requireEmailVerification: true,
  });

  // Profile DB (enrollments, linked student, reminders for /dashboard). Optional when the
  // runtime has no writable disk / node:sqlite — the session store is the login authority.
  // ADMIN_EMAILS addresses keep the chosen self-signup role here; staff rights live in the session store.
  try {
    const created = await createUser({
      email,
      name,
      password,
      role,
      track: body.track || (role === "student" ? "grade-12" : null),
      linkedStudentEmail: body.linkedStudentEmail,
    });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }
  } catch (error) {
    console.warn("signup: profile DB unavailable, continuing with session store only", error);
  }

  return verificationResponse(await sendLink(user.id, request.url));
}
