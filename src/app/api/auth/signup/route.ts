import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/adminAllowlist";
import { createUser } from "@/lib/auth/db";
import { checkSignupPassword } from "@/lib/auth/passwordPolicy";
import { hashPassword } from "@/lib/auth/passwords";
import { startExclusiveSession } from "@/lib/auth/session";
import { asPublicUser, ensureUserForProfile, findUserByEmail } from "@/lib/auth/store";
import { isUserRole, type UserRole } from "@/lib/auth/types";

export const runtime = "nodejs";

/**
 * Teacher / admin accounts carry staff powers (Agent Hub, codes, approvals). They are never chosen in
 * the form: only an email on the ADMIN_EMAILS allowlist becomes admin; everyone else is student/parent.
 */
const SELF_SIGNUP_ROLES: UserRole[] = ["student", "parent"];

export async function POST(request: Request) {
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
  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "هذا البريد مسجّل مسبقاً" }, { status: 400 });
  }
  const admin = isAdminEmail(email);

  // SQLite profile (enrollments, linked student, reminders for /dashboard). Optional when the
  // runtime has no writable disk / node:sqlite — the session store below is the login authority.
  try {
    const created = await createUser({
      email,
      name,
      password,
      role: admin ? "teacher" : role,
      track: admin ? null : body.track || (role === "student" ? "grade-12" : null),
      linkedStudentEmail: body.linkedStudentEmail,
    });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }
  } catch (error) {
    console.warn("signup: profile DB unavailable, continuing with session store only", error);
  }

  const user = await ensureUserForProfile({ email, name, role: admin ? "admin" : role, passwordHash: hashPassword(password) });
  await startExclusiveSession(user.id, request.headers.get("user-agent") ?? undefined);
  return NextResponse.json({ ok: true, user: asPublicUser(user), redirectTo: "/dashboard" });
}
