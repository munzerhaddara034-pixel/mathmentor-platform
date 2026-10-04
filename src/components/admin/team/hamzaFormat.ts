/** Display helpers for Hamza cards (Beirut time, USD). */
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";

export function beirutTime(iso: string | undefined, locale: Locale): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], { timeZone: "Asia/Beirut", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

export function beirutDateTime(iso: string, locale: Locale): string {
  try {
    return new Date(iso).toLocaleString(INTL_LOCALE[locale], { timeZone: "Asia/Beirut", dateStyle: "short", timeStyle: "short", hour12: false });
  } catch {
    return iso;
  }
}

export function usd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `$${value < 0.1 ? value.toFixed(3) : value.toFixed(2)}`;
}
