import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth/db";
import { setSessionCookie } from "@/lib/auth/server";
import { verifyPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "أدخل البريد وكلمة المرور" }, { status: 400 });
  }
  const found = findUserByEmail(email);
  if (!found || !verifyPassword(password, found.passwordHash)) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }
  await setSessionCookie(found.user);
  return NextResponse.json({ user: found.user });
}
