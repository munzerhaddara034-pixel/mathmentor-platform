import type { DeviceClass, DeviceFingerprint } from "./device";

const DEVICE_ID_KEY = "mm_device_id";
/** QA override: set to "mobile" or "desktop" in localStorage to simulate a second class. */
export const QA_DEVICE_CLASS_KEY = "mm_qa_device_class";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function collectDeviceFingerprint(): DeviceFingerprint {
  let deviceId = "";
  let qaClass: DeviceClass | undefined;
  try {
    deviceId = window.localStorage.getItem(DEVICE_ID_KEY) || "";
    if (!deviceId) {
      deviceId = randomId();
      window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    const qa = window.localStorage.getItem(QA_DEVICE_CLASS_KEY)?.trim().toLowerCase();
    if (qa === "mobile" || qa === "desktop") qaClass = qa;
  } catch {
    deviceId = `ephemeral-${randomId()}`;
  }
  const screen =
    typeof window !== "undefined"
      ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
      : "";
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    timezone = "";
  }
  return {
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    screen,
    timezone,
    deviceId,
    deviceClass: qaClass,
  };
}
