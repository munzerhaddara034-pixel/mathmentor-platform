import { hashToken } from "./passwords";

export type DeviceClass = "mobile" | "desktop";

export type DeviceFingerprint = {
  userAgent?: string;
  screen?: string;
  timezone?: string;
  deviceId?: string;
  deviceClass?: DeviceClass;
};

const MOBILE_UA =
  /Mobile|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone|iPad|Tablet|Silk/i;

export function classifyDevice(userAgent?: string | null, hint?: string | null): DeviceClass {
  const override = (hint ?? "").trim().toLowerCase();
  if (override === "mobile" || override === "desktop") return override;
  return MOBILE_UA.test(userAgent ?? "") ? "mobile" : "desktop";
}

export function fingerprintHash(input: DeviceFingerprint) {
  const raw = [
    input.userAgent?.trim() || "",
    input.screen?.trim() || "",
    input.timezone?.trim() || "",
    input.deviceId?.trim() || "",
  ].join("|");
  return hashToken(raw || "unknown-device");
}

export function deviceClassLabel(deviceClass: DeviceClass) {
  return deviceClass === "mobile"
    ? { en: "mobile", ar: "الهاتف" }
    : { en: "desktop", ar: "الحاسوب" };
}

export const DEVICE_TZ = "Asia/Beirut";

export function describeUserAgent(userAgent?: string | null) {
  const ua = userAgent ?? "";
  let os = "Unknown";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows Phone/i.test(ua)) os = "Windows Phone";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/CrOS/i.test(ua)) os = "Chrome OS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//i.test(ua) || /FxiOS/i.test(ua)) browser = "Firefox";
  else if (/CriOS/i.test(ua) || (/Chrome\//i.test(ua) && !/Chromium/i.test(ua))) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome|CriOS|Chromium/i.test(ua)) browser = "Safari";
  else if (/Chromium/i.test(ua)) browser = "Chromium";

  return { os, browser };
}

export function deviceDisplayName(userAgent?: string | null, deviceClass?: DeviceClass | string | null) {
  const { os, browser } = describeUserAgent(userAgent);
  const cls = classifyDevice(userAgent, deviceClass);
  const classEn = cls === "mobile" ? "Mobile" : "Desktop";
  const classAr = cls === "mobile" ? "هاتف" : "حاسوب";
  const name = `${os} ${browser}`;
  return {
    name,
    nameWithClass: `${name} (${classEn})`,
    nameWithClassAr: `${name} (${classAr})`,
    os,
    browser,
    deviceClass: cls,
    classEn,
    classAr,
  };
}

/** Asia/Beirut wall clock, e.g. `18/09/2026 17:12`. */
export function formatDeviceTimestamp(iso: string | Date = new Date()) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DEVICE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(",", "");
}
