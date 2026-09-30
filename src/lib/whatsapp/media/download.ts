/**
 * Download inbound WhatsApp media with MIME allowlist + size limit enforcement.
 * Meta: GET /{media-id} → { url, mime_type, file_size } → GET url with bearer token.
 * UltraMsg / Twilio: direct media URL (auth attached by the adapter helper rules).
 */
import { metaAccessToken } from "@/lib/whatsapp/adapter";
import { graphErrorDetail, graphUrl } from "./graph";
import { baseMime, checkInboundMedia, INBOUND_MAX_BYTES, type MediaCategory } from "./policy";

const DOWNLOAD_TIMEOUT_MS = 30_000;

export type MediaDownloadFailureReason = "too_big" | "unsupported" | "empty" | "download_failed";

export type MediaDownloadSuccess = {
  ok: true;
  bytes: Buffer;
  mimeType: string;
  category: MediaCategory;
  sizeBytes: number;
  sha256?: string;
};
export type MediaDownloadFailure = {
  ok: false;
  reason: MediaDownloadFailureReason;
  error: string;
  mimeType?: string;
  sizeBytes?: number;
  limitBytes?: number;
};
export type MediaDownloadResult = MediaDownloadSuccess | MediaDownloadFailure;

type MetaMediaMeta = { url?: string; mime_type?: string; file_size?: number | string; sha256?: string };

function fail(reason: MediaDownloadFailureReason, error: string, extra?: Partial<MediaDownloadFailure>): MediaDownloadFailure {
  return { ok: false, reason, error, ...extra };
}

/** Read a response body, aborting as soon as it exceeds `maxBytes`. */
async function readCapped(response: Response, maxBytes: number): Promise<Buffer | "too_big"> {
  const declared = Number(response.headers.get("content-length") || "");
  if (Number.isFinite(declared) && declared > maxBytes) return "too_big";
  if (!response.body) return Buffer.from(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return "too_big";
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}

function finalize(bytes: Buffer, mimeHint: string | undefined, maxBytes: number, sha256?: string): MediaDownloadResult {
  const check = checkInboundMedia({ mimeType: mimeHint, sizeBytes: bytes.length, maxBytes });
  if (!check.ok) {
    return fail(check.reason, `media rejected: ${check.reason}`, {
      mimeType: check.mimeType,
      sizeBytes: bytes.length,
      limitBytes: check.limitBytes,
    });
  }
  return { ok: true, bytes, mimeType: check.mimeType, category: check.category, sizeBytes: bytes.length, sha256 };
}

/** Meta Cloud API media id → bytes (validated). Never throws. */
export async function downloadMetaMedia(
  mediaId: string,
  options?: { mimeHint?: string; maxBytes?: number },
): Promise<MediaDownloadResult> {
  const maxBytes = options?.maxBytes ?? INBOUND_MAX_BYTES;
  const token = metaAccessToken();
  if (!mediaId.trim()) return fail("download_failed", "empty media id");
  if (!token) return fail("download_failed", "WHATSAPP_ACCESS_TOKEN / WHATSAPP_TOKEN missing");

  // Pre-check the webhook's declared MIME before any network call.
  if (options?.mimeHint) {
    const pre = checkInboundMedia({ mimeType: options.mimeHint, maxBytes });
    if (!pre.ok) return fail(pre.reason, `media rejected: ${pre.reason}`, { mimeType: pre.mimeType });
  }

  let meta: MetaMediaMeta;
  try {
    const res = await fetch(graphUrl(encodeURIComponent(mediaId)), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!res.ok) return fail("download_failed", `Meta media metadata ${await graphErrorDetail(res)}`);
    meta = (await res.json()) as MetaMediaMeta;
  } catch (error) {
    return fail("download_failed", error instanceof Error ? error.message : "Meta media metadata failed");
  }
  if (!meta.url) return fail("download_failed", "Meta media metadata missing url");

  const mimeType = baseMime(meta.mime_type || options?.mimeHint);
  const declaredSize = Number(meta.file_size);
  const pre = checkInboundMedia({
    mimeType,
    sizeBytes: Number.isFinite(declaredSize) && declaredSize > 0 ? declaredSize : undefined,
    maxBytes,
  });
  if (!pre.ok) {
    return fail(pre.reason, `media rejected: ${pre.reason}`, {
      mimeType: pre.mimeType,
      sizeBytes: pre.sizeBytes,
      limitBytes: pre.limitBytes,
    });
  }

  try {
    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!fileRes.ok) return fail("download_failed", `Meta media download ${fileRes.status}`);
    const body = await readCapped(fileRes, maxBytes);
    if (body === "too_big") {
      return fail("too_big", "media exceeds size limit", { mimeType, limitBytes: maxBytes, sizeBytes: declaredSize || undefined });
    }
    return finalize(body, mimeType || fileRes.headers.get("content-type") || undefined, maxBytes, meta.sha256);
  } catch (error) {
    return fail("download_failed", error instanceof Error ? error.message : "Meta media download failed");
  }
}

function providerAuthHeaders(mediaUrl: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const metaTok = metaAccessToken();
  if (metaTok && /graph\.facebook|fbcdn|whatsapp/i.test(mediaUrl)) headers.Authorization = `Bearer ${metaTok}`;
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const tok = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (sid && tok && /twilio\.com/i.test(mediaUrl)) {
    headers.Authorization = `Basic ${Buffer.from(`${sid}:${tok}`).toString("base64")}`;
  }
  return headers;
}

/** Direct media URL (UltraMsg / Twilio) → bytes (validated). Never throws. */
export async function downloadMediaUrl(
  mediaUrl: string,
  options?: { mimeHint?: string; maxBytes?: number },
): Promise<MediaDownloadResult> {
  const maxBytes = options?.maxBytes ?? INBOUND_MAX_BYTES;
  if (!/^https:\/\//i.test(mediaUrl)) return fail("download_failed", "media URL must be https");
  try {
    const res = await fetch(mediaUrl, {
      headers: providerAuthHeaders(mediaUrl),
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!res.ok) return fail("download_failed", `media URL download ${res.status}`);
    const mimeType = baseMime(options?.mimeHint || res.headers.get("content-type"));
    const pre = checkInboundMedia({ mimeType, maxBytes });
    if (!pre.ok) {
      await res.body?.cancel().catch(() => undefined);
      return fail(pre.reason, `media rejected: ${pre.reason}`, { mimeType: pre.mimeType });
    }
    const body = await readCapped(res, maxBytes);
    if (body === "too_big") return fail("too_big", "media exceeds size limit", { mimeType, limitBytes: maxBytes });
    return finalize(body, mimeType, maxBytes);
  } catch (error) {
    return fail("download_failed", error instanceof Error ? error.message : "media URL download failed");
  }
}
