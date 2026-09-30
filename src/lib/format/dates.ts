import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Date/time formatting with Latin digits, always in Asia/Beirut. The optional `locale` follows the UI
 * language (en / ar / fr); callers that pass none keep the original Arabic (Lebanon) output.
 */
const DEFAULT_TAG = "ar-LB-u-nu-latn";
const TIME_ZONE = "Asia/Beirut";

export function formatBeirut(iso: string, options: Intl.DateTimeFormatOptions, locale?: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale ? INTL_LOCALE[locale] : DEFAULT_TAG, { timeZone: TIME_ZONE, ...options }).format(date);
}

export function formatBeirutDate(iso: string, locale?: Locale): string {
  return formatBeirut(iso, { weekday: "long", day: "numeric", month: "long" }, locale);
}

export function formatBeirutTime(iso: string, locale?: Locale): string {
  return formatBeirut(iso, { hour: "2-digit", minute: "2-digit", hour12: false }, locale);
}

/** YYYY-MM-DD for a date in Beirut (matches gamification `todayBeirut`). */
export function beirutDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Day label + time separately (slot tiles): { day: "Today" | "Mon 5 Oct", time: "16:00" }. */
export function formatWhenParts(iso: string, locale: Locale, words: { today: string; tomorrow: string }, now = new Date()): { day: string; time: string } {
  const time = formatBeirutTime(iso, locale);
  const day = beirutDayKey(new Date(iso));
  if (day === beirutDayKey(now)) return { day: words.today, time };
  if (day === beirutDayKey(new Date(now.getTime() + 86_400_000))) return { day: words.tomorrow, time };
  return { day: formatBeirut(iso, { weekday: "short", day: "numeric", month: "short" }, locale), time };
}

/** «Today 16:00» / «Tomorrow 15:00» / «Thu 2 Oct · 17:30» for slot and session labels. */
export function formatWhen(iso: string, locale: Locale, words: { today: string; tomorrow: string }, now = new Date()): string {
  const time = formatBeirutTime(iso, locale);
  const day = beirutDayKey(new Date(iso));
  if (day === beirutDayKey(now)) return `${words.today} ${time}`;
  if (day === beirutDayKey(new Date(now.getTime() + 86_400_000))) return `${words.tomorrow} ${time}`;
  return `${formatBeirut(iso, { weekday: "short", day: "numeric", month: "short" }, locale)} · ${time}`;
}
