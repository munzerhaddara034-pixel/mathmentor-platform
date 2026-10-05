/**
 * Lebanese-friendly Arabic replies for WhatsApp media problems (محمد).
 * Dependency-free (unit-tested). Brand: الأستاذ منذر حداره only.
 */

export type MediaErrorReason =
  | "too_big"
  | "unsupported"
  | "empty"
  | "download_failed"
  | "processing_failed"
  | "unreadable_document"
  | "send_failed"
  | "ai_busy";

export const MEDIA_SIGNATURE_AR = "— محمد — منذر حداره · MathMentor";

export const SUPPORTED_MEDIA_HINT_AR =
  "بقدر إستلم: صور (JPG / PNG / WEBP)، ملفات PDF، Word أو نص، وفيديو MP4، ومذكرات صوتية.";

export function mediaErrorReplyAr(
  reason: MediaErrorReason,
  details?: { sizeMb?: string; limitMb?: string; mimeType?: string; kindAr?: string },
): string {
  const what = details?.kindAr || "الملف";
  let body: string;
  switch (reason) {
    case "too_big":
      body =
        `${what} كبير كتير${details?.sizeMb ? ` (${details.sizeMb} ميغابايت)` : ""} 😅\n` +
        `الحد الأقصى ${details?.limitMb || "20"} ميغابايت. فيك تضغطو أو تقسّمو لأجزاء وتبعتلي ياه مرة تانية؟`;
      break;
    case "unsupported":
      body =
        `عذراً، نوع ${what}${details?.mimeType ? ` (${details.mimeType})` : ""} مش مدعوم حالياً.\n` +
        SUPPORTED_MEDIA_HINT_AR;
      break;
    case "empty":
      body = `${what} وصل فاضي (حجمو صفر). جرّب تبعتو مرة تانية لو سمحت.`;
      break;
    case "download_failed":
      body =
        `ما قدرت نزّل ${what} من واتساب 🙏\n` +
        "ممكن يكون الرابط انتهت صلاحيتو أو في مشكلة بالاتصال. جرّب تبعتو مرة تانية بعد شوي.";
      break;
    case "unreadable_document":
      body =
        `استلمت ${what} وحفظتو بملفاتك ✅، بس ما بقدر إقرا هالنوع مباشرة.\n` +
        "إذا بدك حلّ أو ملخّص، ابعتلي ياه PDF أو صورة واضحة.";
      break;
    case "send_failed":
      body = `ما زبط معي إبعتلك ${what} هلّق. رح تلاقيه بـ Agent Hub، وجرّب تطلبو مرة تانية بعد شوي.`;
      break;
    case "ai_busy":
      body =
        `استلمت ${what} وحفظتو ✅ بس خدمة الذكاء الاصطناعي (Gemini) مضغوطة هلّق وما قدرت كمّل.\n` +
        "ابعتلي ياه مرة تانية بعد دقيقة أو دقيقتين.";
      break;
    case "processing_failed":
    default:
      body =
        `استلمت ${what} ✅ بس صار في مشكلة وأنا عم عالجو.\n` +
        "الملف محفوظ بـ Agent Hub. جرّب مرة تانية أو ابعتلي صورة أوضح.";
      break;
  }
  return `${body}\n${MEDIA_SIGNATURE_AR}`;
}

/** Arabic noun for a media category (for messages). */
export function mediaKindAr(kind: string | undefined): string {
  if (kind === "image") return "الصورة";
  if (kind === "document") return "الملف";
  if (kind === "video") return "الفيديو";
  if (kind === "audio") return "المقطع الصوتي";
  if (kind === "sticker") return "الملصق";
  return "الملف";
}
