/**
 * Polite bilingual notices when Whisper/OpenAI STT is unavailable.
 * Never dump raw API JSON to students or teachers.
 */

export const WHISPER_NO_KEY_NOTICE_EN =
  "Speech recognition is in practice mode (OpenAI Whisper key not configured). A clear demo transcript is used so teaching can continue.";
export const WHISPER_NO_KEY_NOTICE_AR =
  "التعرّف على الكلام في وضع التدريب (مفتاح Whisper غير مُعدّ). يُستخدم نص تجريبي واضح حتى يستمر الشرح.";

export const WHISPER_QUOTA_NOTICE_EN =
  "Speech recognition is temporarily unavailable (OpenAI billing / credits). A practice demo transcript is shown so you can continue the lesson.";
export const WHISPER_QUOTA_NOTICE_AR =
  "التعرّف على الكلام غير متاح مؤقتًا (فوترة أو رصيد OpenAI). يُعرض نص تجريبي للتدريب حتى تتمكن من متابعة الدرس.";

export const WHISPER_GENERIC_FAIL_NOTICE_EN =
  "Speech recognition could not complete. A practice demo transcript is shown so you can continue.";
export const WHISPER_GENERIC_FAIL_NOTICE_AR =
  "تعذّر إكمال التعرّف على الكلام. يُعرض نص تجريبي للتدريب حتى تتمكن من المتابعة.";

export function isWhisperQuotaError(message: string): boolean {
  return /insufficient_quota|billing|quota|429|402|credit/i.test(message);
}

export function politeWhisperFallbackNotice(technical?: string): { warning: string; warningAr: string } {
  const tech = technical ?? "";
  if (!tech || /OPENAI_API_KEY is not set/i.test(tech)) {
    return { warning: WHISPER_NO_KEY_NOTICE_EN, warningAr: WHISPER_NO_KEY_NOTICE_AR };
  }
  if (isWhisperQuotaError(tech)) {
    return { warning: WHISPER_QUOTA_NOTICE_EN, warningAr: WHISPER_QUOTA_NOTICE_AR };
  }
  return { warning: WHISPER_GENERIC_FAIL_NOTICE_EN, warningAr: WHISPER_GENERIC_FAIL_NOTICE_AR };
}

/** WhatsApp agent: never invent a practice dictation when STT fails. */
export const AGENT_STT_FAILED_NOTICE_EN =
  "Could not transcribe this WhatsApp voice note (speech recognition unavailable). Please resend as text or another voice note.";
export const AGENT_STT_FAILED_NOTICE_AR =
  "تعذّر تفريغ المذكرة الصوتية من واتساب (التعرّف على الكلام غير متاح). يرجى إعادة الإرسال كنص أو مذكرة صوتية جديدة.";

export function bilingualWhisperNotice(warning: string, warningAr: string): string {
  return `${warning} / ${warningAr}`;
}
