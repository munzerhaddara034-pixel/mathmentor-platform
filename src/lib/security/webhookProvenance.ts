/**
 * Who really sent an inbound WhatsApp webhook? One decision for all three providers.
 * Dependency-free apart from node:crypto (unit-tested in tests/webhookProvenance.test.mjs).
 *
 *  - Meta Cloud API: X-Hub-Signature-256 (HMAC-SHA256 of the raw body with WHATSAPP_APP_SECRET).
 *  - Twilio: X-Twilio-Signature = base64(HMAC-SHA1(TWILIO_AUTH_TOKEN, fullUrl + sorted(key+value)…)).
 *  - UltraMsg: no signing scheme, so a shared secret in the webhook URL (?secret=…) or the
 *    x-webhook-secret header, compared in constant time (WHATSAPP_WEBHOOK_SECRET, else AGENT_WEBHOOK_SECRET).
 *
 * `privileged` is true only for a cryptographically verified sender. Unverified-but-accepted traffic
 * (because the owner has not configured that provider's secret yet) may get maths help, but never
 * privileged actions: approvals («موافق» / ok), code changes, outbound campaigns.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type InboundSource = "meta" | "ultramsg" | "twilio";

export type ProvenanceDecision =
  | { ok: true; verified: boolean; privileged: boolean; mode: string; warning?: string }
  | { ok: false; status: 401; error: string };

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyMetaSignatureHeader(rawBody: string, header: string | null | undefined, appSecret: string): boolean {
  if (!appSecret || !header) return false;
  const given = header.trim().toLowerCase();
  if (!given.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return constantTimeEqual(expected, given);
}

/** Twilio's documented algorithm (POST): url + concat(sorted param names, name+value), HMAC-SHA1, base64. */
export function twilioSignature(authToken: string, url: string, params: Array<[string, string]>): string {
  const sorted = [...params].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const data = sorted.reduce((acc, [key, value]) => acc + key + value, url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

export function verifyTwilioSignature(input: {
  authToken: string;
  urls: string[];
  params: Array<[string, string]>;
  signatureHeader: string | null | undefined;
}): boolean {
  const given = input.signatureHeader?.trim();
  if (!input.authToken || !given) return false;
  return input.urls.some((url) => constantTimeEqual(twilioSignature(input.authToken, url, input.params), given));
}

/**
 * The URL Twilio signed is the public one. Behind Render's proxy request.url can be an internal
 * http://localhost:10000/… address, so also try the forwarded host/proto and the configured public base.
 */
export function publicUrlCandidates(requestUrl: string, headers: { get(name: string): string | null }, publicBase?: string): string[] {
  const out = new Set<string>();
  let path = "/";
  try {
    const parsed = new URL(requestUrl);
    out.add(parsed.toString());
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    /* relative / malformed — rely on the other candidates */
  }
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host")?.trim();
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (host) out.add(`${proto}://${host}${path}`);
  if (host) out.add(`https://${host}${path}`);
  if (publicBase) {
    try {
      out.add(new URL(path, publicBase.endsWith("/") ? publicBase : `${publicBase}/`).toString());
    } catch {
      /* ignore bad base */
    }
  }
  return [...out];
}

/** Shared-secret check for UltraMsg (no native signing). */
export function ultraMsgSecretMatches(provided: string | null | undefined, secrets: string[]): boolean {
  const given = provided?.trim();
  if (!given) return false;
  return secrets.filter(Boolean).some((secret) => constantTimeEqual(secret.trim(), given));
}

export const UNVERIFIED_PRIVILEGED_REFUSAL_AR =
  "🔒 لم أستطع التحقق من مصدر هذه الرسالة (توقيع واتساب غير مُفعّل على الخادم)، لذلك لا أنفّذ الموافقات أو تعديلات الكود عبر واتساب حالياً. اعتمد المسودّات من Agent Hub داخل المنصة.";

export function inboundProvenance(input: {
  source: InboundSource;
  /** WHATSAPP_PROVIDER (defaults to meta). */
  provider: string;
  rawBody: string | null;
  metaSignatureHeader?: string | null;
  appSecret?: string;
  twilio?: { authToken?: string; urls: string[]; params: Array<[string, string]>; signatureHeader?: string | null };
  ultramsg?: { provided?: string | null; dedicatedSecret?: string; fallbackSecret?: string };
}): ProvenanceDecision {
  const appSecret = input.appSecret?.trim() || "";
  const metaHeader = input.metaSignatureHeader?.trim();

  // Anything that carries a Meta signature header must verify when we can check it.
  if (appSecret && (input.source === "meta" || metaHeader)) {
    if (input.rawBody === null || !verifyMetaSignatureHeader(input.rawBody, metaHeader, appSecret)) {
      return { ok: false, status: 401, error: "Invalid webhook signature." };
    }
    return { ok: true, verified: true, privileged: true, mode: "meta_signature" };
  }

  if (input.source === "meta") {
    return {
      ok: true,
      verified: false,
      privileged: false,
      mode: "meta_unsigned",
      warning: "WHATSAPP_APP_SECRET is not set — Meta webhook signatures are not verified.",
    };
  }

  if (input.source === "twilio") {
    const token = input.twilio?.authToken?.trim() || "";
    if (token) {
      const ok = verifyTwilioSignature({
        authToken: token,
        urls: input.twilio?.urls || [],
        params: input.twilio?.params || [],
        signatureHeader: input.twilio?.signatureHeader,
      });
      if (!ok) return { ok: false, status: 401, error: "Invalid Twilio signature." };
      return { ok: true, verified: true, privileged: true, mode: "twilio_signature" };
    }
  }

  if (input.source === "ultramsg") {
    const dedicated = input.ultramsg?.dedicatedSecret?.trim() || "";
    const fallback = input.ultramsg?.fallbackSecret?.trim() || "";
    const provided = input.ultramsg?.provided?.trim() || "";
    if (ultraMsgSecretMatches(provided, [dedicated, fallback])) {
      return { ok: true, verified: true, privileged: true, mode: "ultramsg_secret" };
    }
    if (provided || dedicated) {
      // A wrong token, or WHATSAPP_WEBHOOK_SECRET configured but not sent.
      return { ok: false, status: 401, error: "Invalid webhook secret." };
    }
  }

  // Unverifiable non-Meta payload.
  if (appSecret && (input.provider || "meta") === "meta") {
    return { ok: false, status: 401, error: "Unsigned webhook refused: Meta Cloud API is the configured provider." };
  }
  return {
    ok: true,
    verified: false,
    privileged: false,
    mode: `${input.source}_unverified`,
    warning:
      input.source === "twilio"
        ? "TWILIO_AUTH_TOKEN is not set — Twilio webhook signatures are not verified."
        : "WHATSAPP_WEBHOOK_SECRET is not set — UltraMsg webhooks are not authenticated.",
  };
}

const lastWarnAt = new Map<string, number>();
/** Loud, once-per-10-minutes-per-message production warning. */
export function warnOnce(message: string, now = Date.now()): boolean {
  if (now - (lastWarnAt.get(message) ?? 0) < 10 * 60_000) return false;
  lastWarnAt.set(message, now);
  console.warn(`[mathmentor] SECURITY WARNING: ${message} Privileged WhatsApp actions (approvals, code changes) are refused until it is set.`);
  return true;
}
