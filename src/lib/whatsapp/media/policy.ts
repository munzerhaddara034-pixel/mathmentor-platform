/**
 * WhatsApp media policy: MIME allowlist + size limits (inbound & outbound).
 * Dependency-free so it can be unit-tested with `node --test`.
 */

export type MediaCategory = "image" | "document" | "audio" | "video";

export type InboundMediaKind = MediaCategory | "sticker";

/** Inbound download cap (Meta allows up to 100MB docs; we keep processing reasonable). */
export const INBOUND_MAX_BYTES = 20 * 1024 * 1024;

/** Meta Cloud API outbound caps per media type. */
export const OUTBOUND_MAX_BYTES: Record<MediaCategory, number> = {
  image: 5 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
};

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const DOCUMENT_MIMES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
const AUDIO_MIMES = ["audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/amr", "audio/opus", "audio/webm"] as const;
const VIDEO_MIMES = ["video/mp4", "video/3gpp"] as const;

const ALLOWLIST: Record<MediaCategory, readonly string[]> = {
  image: IMAGE_MIMES,
  document: DOCUMENT_MIMES,
  audio: AUDIO_MIMES,
  video: VIDEO_MIMES,
};

/** Lowercase MIME without parameters (`audio/ogg; codecs=opus` → `audio/ogg`). */
export function baseMime(mimeType: string | undefined | null): string {
  return (mimeType || "").split(";")[0]!.trim().toLowerCase();
}

/** Category for an allow-listed MIME, or null when not allowed. */
export function categoryForMime(mimeType: string | undefined | null): MediaCategory | null {
  const mime = baseMime(mimeType);
  if (!mime) return null;
  for (const category of Object.keys(ALLOWLIST) as MediaCategory[]) {
    if (ALLOWLIST[category].includes(mime)) return category;
  }
  return null;
}

export function isPdfMime(mimeType: string | undefined | null): boolean {
  return baseMime(mimeType) === "application/pdf";
}

export function isPlainTextMime(mimeType: string | undefined | null): boolean {
  const mime = baseMime(mimeType);
  return mime === "text/plain" || mime === "text/csv";
}

/** MIME types Gemini can read directly as inline file parts. */
export function isGeminiReadableMime(mimeType: string | undefined | null): boolean {
  const category = categoryForMime(mimeType);
  return category === "image" || isPdfMime(mimeType) || isPlainTextMime(mimeType);
}

export type MediaCheckFailure = {
  ok: false;
  reason: "too_big" | "unsupported" | "empty";
  mimeType: string;
  sizeBytes?: number;
  limitBytes?: number;
};
export type MediaCheckSuccess = { ok: true; category: MediaCategory; mimeType: string };
export type MediaCheckResult = MediaCheckSuccess | MediaCheckFailure;

/** Validate an inbound file before/after download. `sizeBytes` may be unknown (metadata only). */
export function checkInboundMedia(input: {
  mimeType: string | undefined | null;
  sizeBytes?: number;
  maxBytes?: number;
}): MediaCheckResult {
  const mimeType = baseMime(input.mimeType);
  const limitBytes = input.maxBytes ?? INBOUND_MAX_BYTES;
  const category = categoryForMime(mimeType);
  if (!category) return { ok: false, reason: "unsupported", mimeType };
  if (typeof input.sizeBytes === "number") {
    if (input.sizeBytes <= 0) return { ok: false, reason: "empty", mimeType, sizeBytes: input.sizeBytes };
    if (input.sizeBytes > limitBytes) {
      return { ok: false, reason: "too_big", mimeType, sizeBytes: input.sizeBytes, limitBytes };
    }
  }
  return { ok: true, category, mimeType };
}

/** Validate an outbound file against Meta's per-type caps and the allowlist. */
export function checkOutboundMedia(input: {
  category: MediaCategory;
  mimeType: string;
  sizeBytes: number;
}): MediaCheckResult {
  const mimeType = baseMime(input.mimeType);
  const allowed = categoryForMime(mimeType);
  if (allowed !== input.category) return { ok: false, reason: "unsupported", mimeType };
  const limitBytes = OUTBOUND_MAX_BYTES[input.category];
  if (input.sizeBytes <= 0) return { ok: false, reason: "empty", mimeType, sizeBytes: input.sizeBytes };
  if (input.sizeBytes > limitBytes) {
    return { ok: false, reason: "too_big", mimeType, sizeBytes: input.sizeBytes, limitBytes };
  }
  return { ok: true, category: input.category, mimeType };
}

/** "3.4" style megabytes for user-facing messages. */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
}

/** Arabic size label: "850 كيلوبايت" / "3.4 ميغابايت". */
export function formatSizeAr(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
  return `${formatMegabytes(bytes)} ميغابايت`;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "audio/opus": "opus",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
};

export function extensionForMime(mimeType: string | undefined | null): string {
  return EXTENSIONS[baseMime(mimeType)] || "bin";
}

/** Filesystem-safe filename (keeps Arabic letters, strips path separators). */
export function safeFilename(name: string | undefined | null, mimeType?: string | null): string {
  const ext = extensionForMime(mimeType);
  const cleaned = (name || "")
    .replace(/\.{2,}/g, "_")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 100);
  if (!cleaned) return `file.${ext}`;
  return /\.[A-Za-z0-9]{1,5}$/.test(cleaned) ? cleaned : `${cleaned}.${ext}`;
}
