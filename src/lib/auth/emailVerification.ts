/**
 * E-mail ownership verification (pure helpers, no Next imports — unit-tested with node --test).
 *
 * Grandfathering: accounts created before this feature have no `emailVerifiedAt` field at all
 * (undefined) and are treated as verified, so existing users — including the owner's account —
 * are never locked out. New signups store `emailVerifiedAt: null` until the link is clicked.
 */
import { createHash, randomBytes } from "node:crypto";

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
/** Minimum gap before login auto-resends a fresh link to an unverified account. */
export const EMAIL_VERIFICATION_RESEND_GAP_MS = 5 * 60 * 1000;

export type EmailVerificationState = {
  tokenHash: string;
  expiresAt: string;
  sentAt: string;
};

export type VerifiableUser = {
  emailVerifiedAt?: string | null;
  emailVerification?: EmailVerificationState | null;
};

/** `undefined` = legacy (pre-verification) account → verified. `null` = pending. */
export function isEmailVerified(user: VerifiableUser | null | undefined): boolean {
  if (!user) return false;
  if (user.emailVerifiedAt === undefined) return true;
  return typeof user.emailVerifiedAt === "string" && user.emailVerifiedAt.length > 0;
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(`mm-email-verify:${token}`).digest("hex");
}

export function newVerificationToken(now = Date.now()): { token: string; state: EmailVerificationState } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    state: {
      tokenHash: hashVerificationToken(token),
      expiresAt: new Date(now + EMAIL_VERIFICATION_TTL_MS).toISOString(),
      sentAt: new Date(now).toISOString(),
    },
  };
}

export type TokenCheck = { ok: true } | { ok: false; reason: "missing" | "mismatch" | "expired" };

export function checkVerificationToken(state: EmailVerificationState | null | undefined, token: string, now = Date.now()): TokenCheck {
  if (!state || !token) return { ok: false, reason: "missing" };
  if (state.tokenHash !== hashVerificationToken(token)) return { ok: false, reason: "mismatch" };
  const expires = Date.parse(state.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) return { ok: false, reason: "expired" };
  return { ok: true };
}

export function shouldResendVerification(state: EmailVerificationState | null | undefined, now = Date.now()): boolean {
  if (!state) return true;
  const sent = Date.parse(state.sentAt);
  return !Number.isFinite(sent) || now - sent >= EMAIL_VERIFICATION_RESEND_GAP_MS;
}

/** Only accept well-formed tokens (base64url, 43 chars for 32 bytes) before touching the store. */
export function isPlausibleVerificationToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

/** Public origin for links: APP_BASE_URL / NEXT_PUBLIC_APP_URL, else the request origin. */
export function verificationLink(token: string, requestOrigin: string, env: Record<string, string | undefined> = process.env): string {
  const configured = (env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  const origin = /^https?:\/\//i.test(configured) ? configured : requestOrigin.replace(/\/+$/, "");
  return `${origin}/login?verify=${encodeURIComponent(token)}`;
}

export function verificationEmail(input: { name: string; link: string }) {
  const safeName = input.name.replace(/[<>&"]/g, "");
  const subject = "MathMentor — أكّد بريدك الإلكتروني / Confirm your email";
  const text = [
    `مرحباً ${safeName}،`,
    "لتفعيل حسابك في MathMentor افتح الرابط التالي ثم أدخل كلمة المرور (صالح 24 ساعة):",
    input.link,
    "",
    `Hi ${safeName}, confirm your MathMentor email by opening the link above and signing in (valid for 24 hours).`,
    "If you did not create this account, ignore this email.",
  ].join("\n");
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6">
<p>مرحباً ${safeName}،</p>
<p>لتفعيل حسابك في MathMentor اضغط الزر التالي (صالح 24 ساعة):</p>
<p><a href="${input.link}" style="background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">تأكيد البريد</a></p>
<p dir="ltr" style="font-size:13px;color:#555">Hi ${safeName}, confirm your email with the button above (valid 24h). If you did not sign up, ignore this email.</p>
</div>`;
  return { subject, text, html };
}
