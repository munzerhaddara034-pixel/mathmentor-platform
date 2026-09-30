import { fmt } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";

/** Shape shared by /api/auth/login and /api/auth/signup error bodies (all fields optional). */
export type AuthErrorPayload = {
  code?: string;
  error?: string;
  errorAr?: string;
  errorEn?: string;
  retryAfterSec?: number;
  resent?: boolean;
};

type ErrorCode = keyof Messages["auth"]["errors"];

function isErrorCode(code: string | undefined, a: Messages["auth"]): code is ErrorCode {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(a.errors, code);
}

/**
 * Picks the UI-locale message for an auth API error. The server keeps sending its own ar/en text
 * (API clients rely on it); the form prefers the machine-readable `code` so fr works too.
 */
export function authErrorMessage(payload: AuthErrorPayload, a: Messages["auth"], fallback: string): string {
  if (payload.code === "rate_limited" || typeof payload.retryAfterSec === "number") {
    const minutes = Math.max(1, Math.ceil((payload.retryAfterSec ?? 60) / 60));
    return fmt(a.rateLimited, { minutes });
  }
  if (payload.code === "verify_expired") return a.verifyExpired;
  if (payload.code === "verify_required") return payload.resent ? a.verifyResent : a.verifyNeeded;
  if (isErrorCode(payload.code, a)) {
    return fmt(a.errors[payload.code], { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH });
  }
  return fallback;
}
