const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const BEIRUT_TZ = "Asia/Beirut";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function weekdayInZone(date: Date, tz: string) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  return WEEKDAY_SHORT[wd] ?? date.getUTCDay();
}

export function formatInTimeZone(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: weekdayInZone(date, tz),
  };
}

export function addYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Convert a civil wall time in `timeZone` to a UTC Date. */
export function wallTimeToUtc(dateYmd: string, timeHm: string, tz: string): Date {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const [hour, minute] = timeHm.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 8; i += 1) {
    const local = formatInTimeZone(new Date(utc), tz);
    const [ly, lm, ld] = local.date.split("-").map(Number);
    const [lh, lmin] = local.time.split(":").map(Number);
    const localAsUtc = Date.UTC(ly, lm - 1, ld, lh, lmin, 0);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = desiredAsUtc - localAsUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export function beirutDayKey(iso: string | Date = new Date()) {
  return formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, BEIRUT_TZ).date;
}

export function startOfBeirutWeek(now = new Date()) {
  const local = formatInTimeZone(now, BEIRUT_TZ);
  const weekday = local.weekday; // 0 Sun … 6 Sat; week starts Monday
  const sinceMonday = weekday === 0 ? 6 : weekday - 1;
  return wallTimeToUtc(addYmd(local.date, -sinceMonday), "00:00", BEIRUT_TZ);
}
