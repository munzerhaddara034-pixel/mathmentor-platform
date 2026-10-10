import { isLocale, type Locale } from "./i18n/config";

export const CONTENT_LANGUAGE_ENV = "LESSON_CONTENT_DEFAULT_LANGUAGE";
export const BUILT_IN_CONTENT_LANGUAGE: Locale = "en";

/**
 * The production language for generated lesson content. Read at call time so
 * tests and long-lived workers can change configuration without a rebuild.
 */
export function defaultContentLanguage(): Locale {
  return isLocale(process.env[CONTENT_LANGUAGE_ENV]) ? process.env[CONTENT_LANGUAGE_ENV] : BUILT_IN_CONTENT_LANGUAGE;
}

export function resolveContentLanguage(value: unknown): Locale {
  return isLocale(value) ? value : defaultContentLanguage();
}
