/**
 * Outbound WhatsApp media for محمد.
 * Meta: POST /{phone-number-id}/media (multipart upload) → media id → POST /{phone-number-id}/messages
 * with `{ type: "document", document: { id } }` — generated files never depend on a public link
 * (the platform's file routes are staff-only and the Render disk is wiped on every deploy).
 * UltraMsg: link, or base64 bytes for documents. Twilio: public link only.
 * Unconfigured: logged to the outbox (no network).
 */
import { configuredWhatsAppProvider, toE164, whatsappConfigured } from "@/lib/whatsapp/adapter";
import { metaSendMessage, metaUploadMedia } from "@/lib/whatsapp/agentCore";
import { appendWhatsAppMessage } from "@/lib/whatsapp/store";
import { graphUrl, metaCredentials } from "./graph";
import { buildMediaMessagePayload, type MediaRef } from "./payload";
import { baseMime, checkOutboundMedia, formatMegabytes, safeFilename, type MediaCategory } from "./policy";
import { checkMediaRecipient } from "./recipientPolicy";
import { saveMediaRecord } from "./store";

const SEND_TIMEOUT_MS = 45_000;
/** UltraMsg caps base64 bodies at ~2–10M chars; keep documents well under (≈1.4MB raw → 1.9M chars). */
const ULTRAMSG_MAX_BASE64_BYTES = 1_400_000;

export type SendMediaInput = {
  type: MediaCategory;
  /** Public https link Meta can fetch. */
  link?: string;
  /** Already-uploaded Meta media id. */
  mediaId?: string;
  /** Raw bytes to upload first (Meta only). */
  bytes?: Buffer;
  mimeType?: string;
  caption?: string;
  filename?: string;
  replyToMessageId?: string;
};

export type SendMediaResult = {
  status: "sent" | "logged" | "failed" | "skipped";
  provider: string;
  to: string;
  messageId?: string;
  mediaId?: string;
  recordId?: string;
  error?: string;
  /** "validation" = rejected locally (bad type/size/recipient input); "provider" = network/API failure. */
  failureStage?: "validation" | "provider";
  at: string;
};

/** Upload bytes to Meta and return the media id. Throws with a secret-free message. */
export async function uploadMetaMedia(bytes: Buffer, mimeType: string, filename: string): Promise<string> {
  const creds = metaCredentials();
  if (!creds) throw new Error("Meta WhatsApp credentials missing (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID)");
  return metaUploadMedia({ cfg: { ...creds, graphUrl }, bytes, mimeType, filename, fetchImpl: fetch });
}

async function sendMetaMediaMessage(to: string, input: SendMediaInput, media: MediaRef): Promise<string | undefined> {
  const creds = metaCredentials();
  if (!creds) throw new Error("Meta WhatsApp credentials missing");
  const payload = buildMediaMessagePayload({
    to,
    type: input.type,
    media,
    caption: input.caption,
    filename: input.filename,
    replyToMessageId: input.replyToMessageId,
  });
  return metaSendMessage({ cfg: { ...creds, graphUrl }, payload, fetchImpl: fetch });
}

/** `link` is an https URL, or (documents) the raw base64 of the file — UltraMsg accepts both. */
async function sendUltraMsgMedia(to: string, input: SendMediaInput, link: string): Promise<void> {
  const instance = process.env.ULTRAMSG_INSTANCE_ID?.trim() || "";
  const token = process.env.ULTRAMSG_TOKEN?.trim() || "";
  const endpoint = input.type === "document" ? "document" : input.type;
  const body: Record<string, string> = { token, to, [endpoint]: link };
  if (input.caption && input.type !== "audio") body.caption = input.caption.slice(0, 1024);
  if (input.type === "document") body.filename = input.filename || "file";
  const res = await fetch(`https://api.ultramsg.com/${encodeURIComponent(instance)}/messages/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`UltraMsg media ${res.status}`);
}

async function sendTwilioMedia(to: string, input: SendMediaInput, link: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const tok = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim() || "";
  const fromAddr = from.startsWith("whatsapp:") ? from : `whatsapp:${from.startsWith("+") ? from : toE164(from)}`;
  const params = new URLSearchParams({ From: fromAddr, To: `whatsapp:${to}`, MediaUrl: link });
  if (input.caption) params.set("Body", input.caption.slice(0, 1024));
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${tok}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Twilio media ${res.status}`);
}

function validateInput(input: SendMediaInput): string | null {
  if (!input.bytes && !input.link && !input.mediaId) return "one of bytes, link or mediaId is required";
  if (input.link && !/^https:\/\//i.test(input.link)) return "link must be https";
  if (input.bytes) {
    const check = checkOutboundMedia({
      category: input.type,
      mimeType: input.mimeType || "",
      sizeBytes: input.bytes.length,
    });
    if (!check.ok) {
      return check.reason === "too_big"
        ? `file too big for ${input.type}: ${formatMegabytes(check.sizeBytes ?? 0)}MB > ${formatMegabytes(check.limitBytes ?? 0)}MB`
        : `${check.reason} mime ${check.mimeType || "(none)"} for ${input.type}`;
    }
  }
  return null;
}

/**
 * Send one media message to one allowed recipient. Never throws.
 * Every attempt is recorded in the outbox + media store (Agent Hub).
 */
export async function sendWhatsAppMedia(
  toRaw: string,
  input: SendMediaInput,
  context?: { replyToSender?: string; relatedId?: string },
): Promise<SendMediaResult> {
  const at = new Date().toISOString();
  const provider = configuredWhatsAppProvider();
  const mimeType = baseMime(input.mimeType) || "application/octet-stream";
  const filename = safeFilename(input.filename, mimeType);
  const normalized: SendMediaInput = { ...input, mimeType, filename };

  const recipient = await checkMediaRecipient(toRaw, { replyToSender: context?.replyToSender });
  if (!recipient.ok) return { status: "skipped", provider, to: recipient.to, error: recipient.error, at };
  const to = recipient.to;

  const invalid = validateInput(normalized);
  if (invalid) return { status: "failed", provider, to, error: invalid, failureStage: "validation", at };

  let status: SendMediaResult["status"] = "logged";
  let messageId: string | undefined;
  let mediaId = input.mediaId;
  let error: string | undefined;

  try {
    if (!whatsappConfigured()) {
      status = "logged";
    } else if (provider === "meta") {
      if (!mediaId && normalized.bytes) mediaId = await uploadMetaMedia(normalized.bytes, mimeType, filename);
      const ref: MediaRef = mediaId ? { id: mediaId } : { link: normalized.link! };
      messageId = await sendMetaMediaMessage(to, normalized, ref);
      status = "sent";
    } else if (normalized.link && (provider === "ultramsg" || provider === "twilio")) {
      if (provider === "ultramsg") await sendUltraMsgMedia(to, normalized, normalized.link);
      else await sendTwilioMedia(to, normalized, normalized.link);
      status = "sent";
    } else if (provider === "ultramsg" && normalized.bytes && normalized.type === "document" && normalized.bytes.length <= ULTRAMSG_MAX_BASE64_BYTES) {
      // No public link needed: UltraMsg takes the document itself as base64.
      await sendUltraMsgMedia(to, normalized, normalized.bytes.toString("base64"));
      status = "sent";
    } else {
      status = "failed";
      error = `provider ${provider} needs a public https link for media (bytes upload is Meta-only)`;
    }
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : "media send failed";
  }

  const summary = `[${input.type}] ${filename}${input.caption ? ` — ${input.caption.slice(0, 200)}` : ""}`;
  let recordId: string | undefined;
  try {
    await appendWhatsAppMessage({
      to: `+${to}`,
      body: summary,
      kind: "agent_ops",
      relatedId: context?.relatedId,
      status,
      provider: status === "logged" ? "log" : provider,
      error,
    });
    const record = await saveMediaRecord({
      direction: "outbound",
      kind: input.type,
      mimeType,
      filename,
      bytes: normalized.bytes,
      to,
      caption: input.caption,
      provider,
      waMediaId: mediaId,
      waMessageId: messageId,
      status: status === "sent" ? "sent" : status === "logged" ? "logged" : "failed",
      note: error || (input.link ? `link: ${input.link.slice(0, 200)}` : undefined),
      relatedIds: context?.relatedId ? [context.relatedId] : [],
    });
    recordId = record.id;
  } catch {
    /* logging must never break the send result */
  }

  return {
    status,
    provider,
    to,
    messageId,
    mediaId,
    recordId,
    error,
    failureStage: status === "failed" ? "provider" : undefined,
    at,
  };
}
