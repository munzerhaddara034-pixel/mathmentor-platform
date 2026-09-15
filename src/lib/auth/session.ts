export const SESSION_COOKIE = "mm_session";
const SESSION_DAYS = 14;

export type CookieSession = {
  id: string;
  email: string;
  name: string;
  role: "student" | "teacher" | "parent";
  linkedStudentId?: string | null;
  track?: string | null;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function sessionSecret() {
  return process.env.AUTH_SECRET || process.env.MM_AUTH_SECRET || "mathmentor-dev-secret-change-me";
}

function bytesToB64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(payload: Omit<CookieSession, "exp">) {
  const session: CookieSession = {
    ...payload,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = bytesToB64url(encoder.encode(JSON.stringify(session)));
  const key = await hmacKey(sessionSecret());
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${bytesToB64url(signature)}`;
}

export async function readSessionFromCookieValue(token: string): Promise<CookieSession | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const key = await hmacKey(sessionSecret());
  const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(signature), encoder.encode(body));
  if (!ok) return null;
  try {
    const session = JSON.parse(decoder.decode(b64urlToBytes(body))) as CookieSession;
    if (!session?.id || !session.email || !session.role || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
