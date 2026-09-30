import { LOCALE_COOKIE, type Locale } from "./config";

/** Server-side Set-Cookie options for the locale (readable by SSR; not httpOnly so the client switcher can mirror it). */
export const LOCALE_COOKIE_OPTIONS = { path: "/", maxAge: 31_536_000, sameSite: "lax" as const, httpOnly: false };

export function localeCookie(locale: Locale) {
  return { name: LOCALE_COOKIE, value: locale, ...LOCALE_COOKIE_OPTIONS };
}
