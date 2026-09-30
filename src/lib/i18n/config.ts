/** Site locales. English is the default (global platform); Arabic is RTL; French is LTR. */
export const LOCALES = ["en", "ar", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export type Direction = "ltr" | "rtl";

export const DEFAULT_LOCALE: Locale = "en";
/** Server-readable cookie so SSR renders the right lang/dir (no flash). */
export const LOCALE_COOKIE = "mm-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function dirFor(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}

/** BCP-47 tags for Intl (Latin digits everywhere, as the rest of the platform does). */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  ar: "ar-LB-u-nu-latn",
  fr: "fr-FR",
};

/** Endonyms shown in the switcher. */
export const LOCALE_LABEL: Record<Locale, string> = { en: "English", ar: "العربية", fr: "Français" };
export const LOCALE_SHORT: Record<Locale, string> = { en: "EN", ar: "ع", fr: "FR" };
