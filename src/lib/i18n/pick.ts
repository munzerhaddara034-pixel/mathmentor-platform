import type { Locale } from "./config";

/** Content that only exists in Arabic + English (course/lesson titles): Arabic for `ar`, English otherwise. */
export function pickTitle(locale: Locale, item: { title: string; arabicTitle: string }): string {
  return locale === "ar" ? item.arabicTitle || item.title : item.title || item.arabicTitle;
}

/**
 * Payloads that carry an English and an Arabic variant (`message` / `messageAr`, optionally `messageFr`):
 * Arabic for `ar`, French for `fr` when present, English otherwise.
 */
export function pickLang(locale: Locale, en: string | undefined, ar: string | undefined, fr?: string): string {
  if (locale === "ar") return ar || en || "";
  if (locale === "fr" && fr) return fr;
  return en || ar || "";
}
