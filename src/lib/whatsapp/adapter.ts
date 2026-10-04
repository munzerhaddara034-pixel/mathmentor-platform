import { metaDownloadMedia, metaSendMessage, metaTextPayload } from "./agentCore";
import { graphUrl } from "./graphBase";
import { providerMediaAuthHeaders } from "./mediaHosts";
import { appendWhatsAppMessage } from "./store";
import type { WhatsAppKind, WhatsAppMessage, WhatsAppProvider } from "./types";

export function configuredWhatsAppProvider(): WhatsAppProvider {
  const named = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (named === "twilio" || named === "ultramsg" || named === "meta") return named;
  // Auto-detect Meta when Cloud API credentials exist and no explicit provider.
  if (
    !named &&
    (process.env.WHATSAPP_ACCESS_TOKEN?.trim() || process.env.WHATSAPP_TOKEN?.trim()) &&
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  ) {
    return "meta";
  }
  return "log";
}

export function whatsappConfigured() {
  const provider = configuredWhatsAppProvider();
  if (provider === "twilio") {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
        process.env.TWILIO_AUTH_TOKEN?.trim() &&
        process.env.TWILIO_WHATSAPP_FROM?.trim(),
    );
  }
  if (provider === "ultramsg") {
    return Boolean(process.env.ULTRAMSG_INSTANCE_ID?.trim() && process.env.ULTRAMSG_TOKEN?.trim());
  }
  if (provider === "meta") {
    return Boolean(metaAccessToken() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
  }
  return false;
}

export function metaAccessToken(): string {
  return (
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.WHATSAPP_TOKEN?.trim() ||
    ""
  );
}

/** Digits-only phone (no +). Lebanon 7/8 local → 961… */
export function toE164(phone: string) {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 8) digits = `961${digits.slice(1)}`;
  if (digits.length === 8) digits = `961${digits}`;
  if (digits.length === 7) digits = `961${digits}`;
  return digits ? `+${digits}` : "";
}

/** Normalize to country+national digits (no +) for comparisons. */
export function normalizeWhatsAppDigits(phone: string): string {
  const e164 = toE164(phone);
  return e164.replace(/^\+/, "");
}

async function sendTwilio(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM!.trim();
  const fromAddr = from.startsWith("whatsapp:") ? from : `whatsapp:${from.startsWith("+") ? from : toE164(from)}`;
  const params = new URLSearchParams({
    From: fromAddr,
    To: `whatsapp:${to}`,
    Body: body,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!response.ok) {
    throw new Error(`Twilio ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
}

async function sendUltraMsg(to: string, body: string) {
  const instance = process.env.ULTRAMSG_INSTANCE_ID!.trim();
  const token = process.env.ULTRAMSG_TOKEN!.trim();
  const response = await fetch(`https://api.ultramsg.com/${encodeURIComponent(instance)}/messages/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, to, body }),
  });
  if (!response.ok) {
    throw new Error(`UltraMsg ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
}

async function sendMeta(to: string, body: string) {
  const token = metaAccessToken();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  await metaSendMessage({ cfg: { token, phoneNumberId, graphUrl }, payload: metaTextPayload(to, body), fetchImpl: fetch });
}

export async function sendWhatsApp(input: {
  to: string;
  body: string;
  bodyAr?: string;
  kind: WhatsAppKind;
  relatedId?: string;
}): Promise<WhatsAppMessage> {
  const to = toE164(input.to);
  const text =
    input.bodyAr && input.bodyAr !== input.body
      ? `${input.body}\n\n${input.bodyAr}`
      : input.bodyAr || input.body;
  const provider = configuredWhatsAppProvider();
  const canSend = Boolean(to) && whatsappConfigured();

  if (!canSend) {
    return appendWhatsAppMessage({
      to: to || input.to || "(missing phone)",
      body: text,
      bodyAr: input.bodyAr,
      kind: input.kind,
      relatedId: input.relatedId,
      status: "logged",
      provider: "log",
    });
  }

  try {
    if (provider === "twilio") await sendTwilio(to, text);
    else if (provider === "ultramsg") await sendUltraMsg(to, text);
    else if (provider === "meta") await sendMeta(to, text);
    return appendWhatsAppMessage({
      to,
      body: text,
      bodyAr: input.bodyAr,
      kind: input.kind,
      relatedId: input.relatedId,
      status: "sent",
      provider,
    });
  } catch (error) {
    return appendWhatsAppMessage({
      to,
      body: text,
      bodyAr: input.bodyAr,
      kind: input.kind,
      relatedId: input.relatedId,
      status: "failed",
      provider,
      error: error instanceof Error ? error.message : "send failed",
    });
  }
}

/** Whish / payment / default teacher notify phone (not agent-ops allowlist). */
export function teacherWhatsApp() {
  return (
    process.env.TEACHER_WHATSAPP?.trim() ||
    process.env.ACADEMY_WHATSAPP?.trim() ||
    "96170772968"
  );
}

/**
 * Instructor phone allowed to drive the autonomous agent via WhatsApp voice.
 * Default: 96176532421 (local 76532421) — not the Whish wallet 96170772968.
 */
export function instructorWhatsAppNumber(): string {
  // Agent-ops allowlist only — never fall back to Whish/payment TEACHER_WHATSAPP (96170772968).
  return process.env.INSTRUCTOR_WHATSAPP_NUMBER?.trim() || "96176532421";
}

export function isAuthorizedInstructorPhone(phone: string | undefined | null): boolean {
  if (!phone?.trim()) return false;
  const got = normalizeWhatsAppDigits(phone);
  const allowed = normalizeWhatsAppDigits(instructorWhatsAppNumber());
  if (!got || !allowed) return false;
  if (got === allowed) return true;
  // Local 7/8 vs 961… already normalized by toE164; also accept trailing national match.
  if (got.endsWith(allowed.slice(-8)) && allowed.endsWith(got.slice(-8))) return true;
  return false;
}

export type MetaMediaFetchSuccess = { ok: true; bytes: Buffer; mimeType?: string };
export type MetaMediaFetchFailure = { ok: false; error: string };
export type MetaMediaFetchResult = MetaMediaFetchSuccess | MetaMediaFetchFailure;

/** Download Meta Cloud API media by id (requires WHATSAPP_ACCESS_TOKEN). Never silent — always ok or error. */
export async function fetchMetaMediaById(mediaId: string): Promise<MetaMediaFetchResult> {
  if (!mediaId.trim()) return { ok: false, error: "empty mediaId" };
  const token = metaAccessToken();
  if (!token) return { ok: false, error: "WHATSAPP_ACCESS_TOKEN / WHATSAPP_TOKEN missing — cannot download Meta media" };
  const result = await metaDownloadMedia({ mediaId, token, graphUrl, fetchImpl: fetch });
  return result.ok ? { ok: true, bytes: result.bytes, mimeType: result.mimeType } : { ok: false, error: result.error };
}

/** Fetch media URL; attaches Meta/Twilio auth when available. */
export async function fetchWhatsAppMediaBytes(
  mediaUrl: string,
): Promise<{ bytes: Buffer; mimeType?: string } | null> {
  try {
    if (!/^https:\/\//i.test(mediaUrl)) return null;
    // Credentials only for the provider's own hosts (parsed hostname, not a substring of the URL).
    const headers = providerMediaAuthHeaders(mediaUrl, {
      metaToken: metaAccessToken(),
      twilioSid: process.env.TWILIO_ACCOUNT_SID?.trim(),
      twilioToken: process.env.TWILIO_AUTH_TOKEN?.trim(),
    });
    const response = await fetch(mediaUrl, { headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    const mimeType = response.headers.get("content-type") || undefined;
    const ab = await response.arrayBuffer();
    return { bytes: Buffer.from(ab), mimeType };
  } catch {
    return null;
  }
}
