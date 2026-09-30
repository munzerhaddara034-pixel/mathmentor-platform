"use client";

import type { Locale } from "@/lib/i18n/config";
import { useI18n } from "./I18nProvider";

/**
 * Feature catalogues (src/lib/i18n/ns/*) are not in the root provider, so only the routes that use
 * them ship their strings. Returns the active locale's slice.
 */
export function useNs<T>(catalogue: Record<Locale, T>): T {
  const { locale } = useI18n();
  return catalogue[locale];
}
