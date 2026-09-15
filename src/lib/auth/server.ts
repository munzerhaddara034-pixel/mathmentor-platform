import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById } from "./db";
import { readSessionFromCookieValue, SESSION_COOKIE, sessionCookieOptions, signSession } from "./session";
import type { SessionUser, UserRole } from "./types";

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSessionFromCookieValue(token);
  if (!session) return null;
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    linkedStudentId: session.linkedStudentId,
    track: session.track,
    phone: session.phone,
  };
}

export async function getFreshSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  return findUserById(session.id) ?? session;
}

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    linkedStudentId: user.linkedStudentId,
    track: user.track,
    phone: user.phone,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

type AuthGate = { ok: true; user: SessionUser } | { ok: false; error: NextResponse };

export async function requireSession(): Promise<AuthGate> {
  const user = await getFreshSession();
  if (!user) {
    return { ok: false, error: NextResponse.json({ error: "يلزم تسجيل الدخول" }, { status: 401 }) };
  }
  return { ok: true, user };
}

export async function requireRole(roles: UserRole[]): Promise<AuthGate> {
  const result = await requireSession();
  if (!result.ok) return result;
  if (!roles.includes(result.user.role)) {
    return { ok: false, error: NextResponse.json({ error: "غير مصرح" }, { status: 403 }) };
  }
  return result;
}
