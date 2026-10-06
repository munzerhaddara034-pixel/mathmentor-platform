/**
 * Download inbound WhatsApp media with MIME allowlist + size limit enforcement.
 * Meta: GET /{media-id} → { url, mime_type, file_size } → GET url with bearer token.
 * UltraMsg / Twilio: direct media URL (auth attached by the adapter helper rules).
 */
import { metaAccessToken } from "@/lib/whatsapp/adapter";
import { finalizeDownload, metaDownloadMedia, readCapped } from "@/lib/whatsapp/agentCore";
import { providerMediaAuthHeaders } from "@/lib/whatsapp/mediaHosts";
import { graphUrl } from "./graph";
import { baseMime, checkInboundMedia, INBOUND_MAX_BYTES, type MediaCategory } from "./policy";
import { assertSafeFetchTarget, BlockedFetchError } from "@/lib/security/safeFetch";

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

/** Meta Cloud API media id → bytes (validated). Never throws. Graph calls live in the tested core. */
export async function downloadMetaMedia(
  mediaId: string,
  options?: { mimeHint?: string; maxBytes?: number },
): Promise<MediaDownloadResult> {
  return metaDownloadMedia({
    mediaId,
    token: metaAccessToken(),
    graphUrl,
    fetchImpl: fetch,
    mimeHint: options?.mimeHint,
    maxBytes: options?.maxBytes,
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
  });
}

function fail(reason: MediaDownloadFailureReason, error: string, extra?: Partial<MediaDownloadFailure>): MediaDownloadFailure {
  return { ok: false, reason, error, ...extra };
}

function providerAuthHeaders(mediaUrl: string): Record<string, string> {
  // Credentials only for the provider's own hosts (parsed hostname, not a substring of the URL).
  return providerMediaAuthHeaders(mediaUrl, {
    metaToken: metaAccessToken(),
    twilioSid: process.env.TWILIO_ACCOUNT_SID?.trim(),
    twilioToken: process.env.TWILIO_AUTH_TOKEN?.trim(),
  });
}

/**
 * Follow a provider media URL with the SSRF guard applied on every hop.
 *
 * The URL arrives inside an untrusted webhook payload, so the host is checked (https only, no
 * credentials, no odd port, no IP literal), every resolved address must be public, and redirects are
 * followed manually so a redirect cannot jump to an internal address. Provider CDNs legitimately
 * live on arbitrary hosts, so the allow-list is the URL's own host rather than a fixed list.
 */
async function fetchProviderMedia(
  mediaUrl: string,
): Promise<{ ok: true; res: Response } | MediaDownloadFailure> {
  let current = mediaUrl;
  for (let hop = 0; hop <= 3; hop += 1) {
    let target: URL;
    try {
      target = await assertSafeFetchTarget(current, { allowed: [new URL(current).hostname] });
    } catch (error) {
      const reason = error instanceof BlockedFetchError ? error.reason : "unsafe_url";
      return fail("download_failed", `media URL blocked: ${reason}`);
    }
    const res = await fetch(target, {
      headers: providerAuthHeaders(current),
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      redirect: "manual",
    });
    if (res.status < 300 || res.status >= 400) return { ok: true, res };
    const location = res.headers.get("location");
    if (!location) return fail("download_failed", "media redirect without location");
    await res.body?.cancel().catch(() => undefined);
    current = new URL(location, target).toString();
  }
  return fail("download_failed", "media URL redirected too many times");
}

/** Direct media URL (UltraMsg / Twilio) → bytes (validated). Never throws. */
export async function downloadMediaUrl(
  mediaUrl: string,
  options?: { mimeHint?: string; maxBytes?: number },
): Promise<MediaDownloadResult> {
  const maxBytes = options?.maxBytes ?? INBOUND_MAX_BYTES;
  if (!/^https:\/\//i.test(mediaUrl)) return fail("download_failed", "media URL must be https");
  try {
    const fetched = await fetchProviderMedia(mediaUrl);
    if (!fetched.ok) return fetched;
    const res = fetched.res;
    if (!res.ok) return fail("download_failed", `media URL download ${res.status}`);
    const mimeType = baseMime(options?.mimeHint || res.headers.get("content-type"));
    const pre = checkInboundMedia({ mimeType, maxBytes });
    if (!pre.ok) {
      await res.body?.cancel().catch(() => undefined);
      return fail(pre.reason, `media rejected: ${pre.reason}`, { mimeType: pre.mimeType });
    }
    const body = await readCapped(res, maxBytes);
    if (body === "too_big") return fail("too_big", "media exceeds size limit", { mimeType, limitBytes: maxBytes });
    return finalizeDownload(body, mimeType, maxBytes);
  } catch (error) {
    return fail("download_failed", error instanceof Error ? error.message : "media URL download failed");
  }
}
