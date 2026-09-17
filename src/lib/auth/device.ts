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
