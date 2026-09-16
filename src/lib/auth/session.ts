import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "./paths";
import {
  createExclusiveSession,
  deleteSessionByToken,
  findSessionByToken,
  type PublicUser,
} from "./store";
import { newSessionToken } from "./passwords";

const MAX_AGE = 60 * 60 * 24 * 30;

/** Secure cookies only on HTTPS so `next start` on localhost still stores the session. */
async function sessionCookieSecure() {
  if (process.env.AUTH_COOKIE_SECURE === "0") return false;
  if (process.env.AUTH_COOKIE_SECURE === "1") return true;
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0]?.trim().toLowerCase();
  if (proto === "https") return true;
  if (proto === "http") return false;
  const host = (h.get("host") ?? "").split(":")[0];
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
  return process.env.NODE_ENV === "production";
}

export type LiveSession =
  | { ok: true; user: PublicUser; sessionId: string }
  | { ok: false; reason: "unauthenticated" | "replaced" };

export async function readSessionCookie() {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function writeSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: await sessionCookieSecure(),
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: await sessionCookieSecure(),
    maxAge: 0,
  });
}

export async function getLiveSession(): Promise<LiveSession> {
  const token = await readSessionCookie();
  if (!token) return { ok: false, reason: "unauthenticated" };
  const found = await findSessionByToken(token);
  if (!found) return { ok: false, reason: "replaced" };
  return { ok: true, user: found.publicUser, sessionId: found.session.id };
}

export async function startExclusiveSession(userId: string, userAgent?: string) {
  const token = newSessionToken();
  await createExclusiveSession(userId, token, userAgent);
  await writeSessionCookie(token);
  return token;
}

export async function endCurrentSession() {
  const token = await readSessionCookie();
  if (token) await deleteSessionByToken(token);
  await clearSessionCookie();
}
