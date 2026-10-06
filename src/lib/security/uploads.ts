/**
 * Shared upload policy for user-supplied files.
 *
 * Why this exists: `file.type` and `file.name` come from the client and are never trustworthy, and
 * writing a user-named file under `public/` lets an attacker park an `.html`/`.svg`/`.js` document on
 * our own origin (stored XSS). So every upload route must:
 *  1. cap the byte size before buffering,
 *  2. sniff the real type from magic bytes,
 *  3. store a server-chosen extension that matches the sniffed type only.
 *
 * Receipts (`src/lib/payments/receipt.ts`) already follow this pattern; this module gives the other
 * upload routes (math solver, tutor chat, voice math) the same rules.
 */
export type UploadCategory = "image" | "audio" | "document";
/** Hard caps per category (bytes). */
export const UPLOAD_MAX_BYTES: Record<UploadCategory, number> = {
  image: 8 * 1024 * 1024,
  audio: 12 * 1024 * 1024,
  document: 8 * 1024 * 1024,
};
type Sniffed = { mime: string; ext: string; category: UploadCategory };
const RIFF = [0x52, 0x49, 0x46, 0x46];
const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
/** ISO-BMFF brand check (`ftyp` at offset 4) used by mp4 / m4a / heic. */
function brand(bytes: Uint8Array): string {
  return startsWith(bytes, ascii("ftyp"), 4) ? String.fromCharCode(...bytes.slice(8, 12)) : "";
}
const IMAGE_BRANDS = ["heic", "heix", "hevc", "heim", "mif1", "msf1"];
/** Real type from magic bytes. Returns null for anything we do not accept. */
export function sniffUpload(bytes: Uint8Array): Sniffed | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg", category: "image" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { mime: "image/png", ext: "png", category: "image" };
  if (startsWith(bytes, ascii("GIF8"))) return { mime: "image/gif", ext: "gif", category: "image" };
  if (startsWith(bytes, RIFF) && startsWith(bytes, ascii("WEBP"), 8)) return { mime: "image/webp", ext: "webp", category: "image" };
  if (IMAGE_BRANDS.includes(brand(bytes))) return { mime: "image/heic", ext: "heic", category: "image" };
  if (startsWith(bytes, ascii("%PDF"))) return { mime: "application/pdf", ext: "pdf", category: "document" };
  if (startsWith(bytes, ascii("ID3"))) return { mime: "audio/mpeg", ext: "mp3", category: "audio" };
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return { mime: "audio/mpeg", ext: "mp3", category: "audio" };
  if (startsWith(bytes, RIFF) && startsWith(bytes, ascii("WAVE"), 8)) return { mime: "audio/wav", ext: "wav", category: "audio" };
  if (startsWith(bytes, ascii("OggS"))) return { mime: "audio/ogg", ext: "ogg", category: "audio" };
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "audio/webm", ext: "webm", category: "audio" };
  if (["isom", "iso2", "mp41", "mp42", "M4A ", "M4V "].includes(brand(bytes))) {
    return { mime: "audio/mp4", ext: "m4a", category: "audio" };
  }
  return null;
}
export type UploadRejection = { ok: false; status: number; error: string; errorAr: string };
export type UploadAccepted = { ok: true; bytes: Buffer; mime: string; ext: string; originalName: string };
export type UploadResult = UploadAccepted | UploadRejection;
function rejected(categories: UploadCategory[], oversize: boolean): UploadRejection {
  const mb = Math.round(Math.max(...categories.map((item) => UPLOAD_MAX_BYTES[item])) / (1024 * 1024));
  return oversize
    ? { ok: false, status: 413, error: `File is too large (max ${mb} MB).`, errorAr: `حجم الملف كبير جداً (الحد ${mb} ميغابايت).` }
    : {
        ok: false,
        status: 415,
        error: `Unsupported file type. Allowed: ${categories.join(", ")}.`,
        errorAr: `نوع الملف غير مدعوم. المسموح: ${categories.join(", ")}.`,
      };
}
/** Size cap → buffer → magic-byte sniff → category check. Never throws. */
export async function readUploadFile(file: File, categories: UploadCategory[]): Promise<UploadResult> {
  const cap = Math.max(...categories.map((item) => UPLOAD_MAX_BYTES[item]));
  if (!Number.isFinite(file.size) || file.size <= 0) return rejected(categories, false);
  if (file.size > cap) return rejected(categories, true);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > cap) return rejected(categories, true);
  const sniffed = sniffUpload(bytes);
  if (!sniffed || !categories.includes(sniffed.category)) return rejected(categories, false);
  return { ok: true, bytes, mime: sniffed.mime, ext: sniffed.ext, originalName: file.name || `upload.${sniffed.ext}` };
}
/** Same rules for base64 payloads (the solver accepts an inline image in JSON). */
export function readInlineUpload(base64: string, categories: UploadCategory[]): UploadResult {
  const cap = Math.max(...categories.map((item) => UPLOAD_MAX_BYTES[item]));
  const raw = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(raw, "base64");
  } catch {
    return rejected(categories, false);
  }
  if (bytes.length > cap) return rejected(categories, true);
  const sniffed = sniffUpload(bytes);
  if (!sniffed || !categories.includes(sniffed.category)) return rejected(categories, false);
  return { ok: true, bytes, mime: sniffed.mime, ext: sniffed.ext, originalName: `inline.${sniffed.ext}` };
}
/** `<timestamp>-<n>.<ext>` — extension chosen by us, never by the client. */
export function uploadFileName(ext: string) {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}