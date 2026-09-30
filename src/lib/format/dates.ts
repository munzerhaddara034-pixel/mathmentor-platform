/** Arabic (Lebanon) date/time formatting with Latin digits, always in Asia/Beirut. */
const LOCALE = "ar-LB-u-nu-latn";
const TIME_ZONE = "Asia/Beirut";

export function formatBeirut(iso: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...options }).format(date);
}

export function formatBeirutDate(iso: string): string {
  return formatBeirut(iso, { weekday: "long", day: "numeric", month: "long" });
}

export function formatBeirutTime(iso: string): string {
  return formatBeirut(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** YYYY-MM-DD for a date in Beirut (matches gamification `todayBeirut`). */
export function beirutDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
