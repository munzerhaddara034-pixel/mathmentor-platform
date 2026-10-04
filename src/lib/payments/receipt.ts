/**
 * Receipt image validation (pure, unit-tested). The declared MIME type and filename are ignored:
 * only the magic bytes decide. JPEG / PNG / WebP up to 5 MB; everything else is rejected.
 */
import { createHash } from "node:crypto";

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ReceiptMime = (typeof RECEIPT_MIME_TYPES)[number];

export function sniffImageMime(bytes: Uint8Array): ReceiptMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type ReceiptCheck =
  | { ok: true; mimeType: ReceiptMime; sizeBytes: number; sha256: string; extension: "jpg" | "png" | "webp" }
  | { ok: false; reason: "empty" | "too_big" | "unsupported"; sizeBytes: number };

export function validateReceipt(bytes: Uint8Array): ReceiptCheck {
  const sizeBytes = bytes.length;
  if (sizeBytes === 0) return { ok: false, reason: "empty", sizeBytes };
  if (sizeBytes > RECEIPT_MAX_BYTES) return { ok: false, reason: "too_big", sizeBytes };
  const mimeType = sniffImageMime(bytes);
  if (!mimeType) return { ok: false, reason: "unsupported", sizeBytes };
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  return { ok: true, mimeType, sizeBytes, sha256: createHash("sha256").update(bytes).digest("hex"), extension };
}
