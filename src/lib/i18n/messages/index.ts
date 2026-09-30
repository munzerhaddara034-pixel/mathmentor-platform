import type { Locale } from "../config";
import { ar } from "./ar";
import { en, type Messages } from "./en";
import { fr } from "./fr";

export type { Messages };

const CATALOG: Record<Locale, Messages> = { en, ar, fr };

/** Server-side lookup; client components receive the one active tree through <I18nProvider>. */
export function messagesFor(locale: Locale): Messages {
  return CATALOG[locale];
}
