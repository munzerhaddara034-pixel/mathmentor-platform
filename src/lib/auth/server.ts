/**
 * Role-dashboard session API (getSession / requireRole …) used by the SQLite dashboard,
 * /api/me/dashboard, /api/auth/me and the teacher APIs.
 *
 * Merge note: there is a single session authority — the exclusive, server-side opaque token
 * in `./session` (`mm_session` cookie, one phone + one computer per student). This module
 * adapts that live session to the `SessionUser` shape and enriches it with the SQLite
 * profile (`./db`: linked student, track, enrollments) when one exists for the same email.
 */
import { NextResponse } from "next/server";
import { findUserByEmail as findProfileByEmail } from "./db";
import { endCurrentSession, getLiveSession } from "./session";
import type { PublicUser } from "./store";
import type { SessionUser, UserRole } from "./types";

export function toDashboardRole(role: string): UserRole {
  if (role === "teacher" || role === "admin") return "teacher";
  if (role === "parent") return "parent";
  return "student";
}

/** SQLite profile lookup that never breaks auth (e.g. read-only serverless FS, Node without node:sqlite). */
function profileForEmail(email: string): SessionUser | null {
  try {
    return findProfileByEmail(email)?.user ?? null;
  } catch {
    return null;
  }
}

export function sessionUserFromLive(user: PublicUser): SessionUser {
  const profile = profileForEmail(user.email);
  return {
    id: profile?.id ?? user.id,
    email: user.email,
    name: profile?.name ?? user.name,
    role: toDashboardRole(user.role),
    linkedStudentId: profile?.linkedStudentId ?? null,
    track: profile?.track ?? null,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const live = await getLiveSession();
  if (!live.ok) return null;
  return sessionUserFromLive(live.user);
}

/** Kept for existing call sites; the live session is already read fresh from the store. */
export async function getFreshSession(): Promise<SessionUser | null> {
  return getSession();
}

export async function clearSessionCookie() {
  await endCurrentSession();
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
