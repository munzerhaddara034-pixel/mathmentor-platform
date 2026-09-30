/** Signup password policy — enforced server-side in /api/auth/signup (the form only mirrors it). */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

/** `code` lets the (translated) form pick its own message; `error` / `errorAr` stay for API clients. */
export type PasswordCheck =
  | { ok: true }
  | { ok: false; code: "password_short" | "password_long" | "password_weak"; error: string; errorAr: string };

/** Short Arabic hint for the signup form. */
export const PASSWORD_RULE_AR = "10 أحرف على الأقل، وفيها حرف واحد ورقم واحد على الأقل.";

export function checkSignupPassword(password: string): PasswordCheck {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: "password_short",
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      errorAr: `كلمة المرور قصيرة: يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل.`,
    };
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      code: "password_long",
      error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
      errorAr: `كلمة المرور طويلة جداً: الحد الأقصى ${PASSWORD_MAX_LENGTH} حرفاً.`,
    };
  }
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
    return {
      ok: false,
      code: "password_weak",
      error: "Password must contain at least one letter and one digit.",
      errorAr: "كلمة المرور ضعيفة: يجب أن تحتوي على حرف واحد ورقم واحد على الأقل.",
    };
  }
  return { ok: true };
}
