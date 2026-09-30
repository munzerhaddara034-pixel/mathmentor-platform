import type { Locale } from "./config";

/** Content that only exists in Arabic + English (course/lesson titles): Arabic for `ar`, English otherwise. */
export function pickTitle(locale: Locale, item: { title: string; arabicTitle: string }): string {
  return locale === "ar" ? item.arabicTitle || item.title : item.title || item.arabicTitle;
}
