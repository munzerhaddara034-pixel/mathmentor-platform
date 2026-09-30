/**
 * Bilingual browser media-permission copy for LiveKit + VoiceRecorder.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره.
 */

export type MediaPermissionKind = "microphone" | "camera" | "both" | "unknown";

export type MediaPermissionCopy = {
  error: string;
  errorAr: string;
  hint: string;
  hintAr: string;
  /** French variants (optional so older call sites keep compiling). */
  errorFr?: string;
  hintFr?: string;
};

const LOCK_HINT_EN =
  "Chrome: click the lock/padlock icon left of the URL → Site settings → Camera & Microphone → Allow → reload or tap Enable again.";
const LOCK_HINT_FR =
  "Chrome : cliquez sur l’icône du cadenas à gauche de l’adresse → Paramètres du site → Caméra et micro → Autoriser → rechargez ou touchez de nouveau Activer.";
const LOCK_HINT_AR =
  "كروم: اضغط أيقونة القفل يسار العنوان ← إعدادات الموقع ← الكاميرا والميكروفون ← سماح ← ثم أعد التحميل أو اضغط تفعيل مرة أخرى.";

export function mediaPermissionCopy(
  kind: MediaPermissionKind = "both",
  detail?: string,
): MediaPermissionCopy {
  const deviceEn =
    kind === "microphone" ? "microphone" : kind === "camera" ? "camera" : "camera & microphone";
  const deviceAr =
    kind === "microphone" ? "الميكروفون" : kind === "camera" ? "الكاميرا" : "الكاميرا والميكروفون";
  const baseEn = `Could not access the ${deviceEn}.`;
  const baseAr = `تعذّر الوصول إلى ${deviceAr}.`;
  const deviceFr = kind === "microphone" ? "au micro" : kind === "camera" ? "à la caméra" : "à la caméra et au micro";
  const baseFr = `Impossible d’accéder ${deviceFr}.`;
  const detailTrim = (detail || "").trim();
  return {
    error: detailTrim ? `${baseEn} ${detailTrim}` : baseEn,
    errorAr: detailTrim ? `${baseAr} ${detailTrim}` : baseAr,
    errorFr: detailTrim ? `${baseFr} ${detailTrim}` : baseFr,
    hint: LOCK_HINT_EN,
    hintAr: LOCK_HINT_AR,
    hintFr: LOCK_HINT_FR,
  };
}

/** Map DOMException / MediaRecorder failures to AR+EN strings. */
export function permissionErrorFromUnknown(
  error: unknown,
  kind: MediaPermissionKind = "microphone",
): MediaPermissionCopy {
  const name =
    error instanceof DOMException
      ? error.name
      : error && typeof error === "object" && "name" in error && typeof (error as { name: unknown }).name === "string"
        ? (error as { name: string }).name
        : "";
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";
  if (name === "NotAllowedError" || /permission|denied|not allowed/i.test(message)) {
    const base = mediaPermissionCopy(kind);
    return {
      ...base,
      error: `${base.error} Permission denied.`,
      errorAr: `${base.errorAr} رُفض الإذن.`,
      errorFr: `${base.errorFr ?? base.error} Autorisation refusée.`,
    };
  }
  if (name === "NotFoundError" || /not found|no device/i.test(message)) {
    const notFoundAr =
      kind === "camera"
        ? "هذا الجهاز لا يحتوي كاميرا ظاهرة — جرّب حاسوبًا بكاميرا أو وصل كاميرا."
        : kind === "microphone"
          ? "هذا الجهاز لا يحتوي ميكروفون ظاهر — جرّب حاسوبًا بميكروفون أو وصل سماعة/ميكروفون."
          : "هذا الجهاز لا يحتوي كاميرا أو ميكروفون ظاهرين — جرّب حاسوبًا بكاميرا أو وصل سماعة/كاميرا.";
    return {
      error: `No ${kind === "camera" ? "camera" : kind === "microphone" ? "microphone" : "camera/microphone"} device found on this machine.`,
      errorAr: notFoundAr,
      errorFr: `Aucun${kind === "camera" ? "e caméra" : kind === "microphone" ? " micro" : "e caméra ni micro"} détecté${kind === "camera" ? "e" : ""} sur cet appareil.`,
      hint: LOCK_HINT_EN,
      hintAr: LOCK_HINT_AR,
      hintFr: LOCK_HINT_FR,
    };
  }
  if (name === "NotReadableError" || /in use|busy|readable/i.test(message)) {
    return {
      error: "Device is busy in another app/tab.",
      errorAr: "الجهاز مشغول في تطبيق أو تبويب آخر.",
      errorFr: "L’appareil est utilisé par une autre application ou un autre onglet.",
      hint: LOCK_HINT_EN,
      hintAr: LOCK_HINT_AR,
      hintFr: LOCK_HINT_FR,
    };
  }
  return mediaPermissionCopy(kind, message || undefined);
}
