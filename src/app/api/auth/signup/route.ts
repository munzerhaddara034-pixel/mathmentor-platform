import { NextResponse } from "next/server";
import { createUser } from "@/lib/auth/db";
import { setSessionCookie } from "@/lib/auth/server";
import { isUserRole } from "@/lib/auth/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    name?: string;
    password?: string;
    role?: string;
    track?: string;
    linkedStudentEmail?: string;
  };
  const email = body.email?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const password = body.password ?? "";
  const role = body.role ?? "student";
  if (!email || !name || password.length < 6) {
    return NextResponse.json({ error: "الاسم والبريد وكلمة مرور من 6 أحرف على الأقل مطلوبة" }, { status: 400 });
  }
  if (!isUserRole(role)) {
    return NextResponse.json({ error: "اختر دوراً صالحاً" }, { status: 400 });
  }
  const created = createUser({
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
  await setSessionCookie(created.user);
  return NextResponse.json({ user: created.user });
}
