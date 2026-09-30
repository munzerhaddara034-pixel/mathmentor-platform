import { cookies } from "next/headers";
import { dirFor, LOCALE_COOKIE, resolveLocale, type Direction, type Locale } from "./config";
import { messagesFor, type Messages } from "./messages";

export type ServerI18n = { locale: Locale; dir: Direction; m: Messages };

/** Locale from the cookie (default `en`) + its message tree, for server components. */
export async function getI18n(): Promise<ServerI18n> {
  let locale: Locale;
  try {
    locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch {
    locale = resolveLocale(undefined);
  }
  return { locale, dir: dirFor(locale), m: messagesFor(locale) };
}
