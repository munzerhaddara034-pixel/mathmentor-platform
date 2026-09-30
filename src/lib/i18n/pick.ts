import type { Locale } from "./config";

/** Content that only exists in Arabic + English (course/lesson titles): Arabic for `ar`, English otherwise. */
export function pickTitle(locale: Locale, item: { title: string; arabicTitle: string }): string {
  return locale === "ar" ? item.arabicTitle || item.title : item.title || item.arabicTitle;
}

/** Server payloads that carry an English and an Arabic variant (`message` / `messageAr`): Arabic for `ar`, English otherwise. */
export function pickLang(locale: Locale, en: string | undefined, ar: string | undefined): string {
  return (locale === "ar" ? ar || en : en || ar) ?? "";
}
