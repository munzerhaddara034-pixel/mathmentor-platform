"use client";

import { createContext, useContext, type ReactNode } from "react";
import { dirFor, type Direction, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/en";

type I18nValue = { locale: Locale; dir: Direction; m: Messages };

const I18nContext = createContext<I18nValue | null>(null);

/** Receives only the active locale's messages from the root layout (serialised once in the RSC payload). */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, dir: dirFor(locale), m: messages }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
