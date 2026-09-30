/**
 * Who محمد may send media to: the instructor allowlist, or the sender of an inbound
 * message (reply). Single recipient per call, rate-limited — no bulk / unsolicited sends.
 */
import { isAuthorizedInstructorPhone, normalizeWhatsAppDigits } from "@/lib/whatsapp/adapter";
import { recentInboundSenders } from "./store";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const sentLog = new Map<string, number[]>();

export type RecipientDecision = { ok: true; to: string } | { ok: false; to: string; error: string };

export async function checkMediaRecipient(
  toRaw: string,
  options?: { replyToSender?: string },
): Promise<RecipientDecision> {
  const to = normalizeWhatsAppDigits(toRaw || "");
  if (!to || to.length < 8) return { ok: false, to, error: "invalid recipient number" };

  let allowed = isAuthorizedInstructorPhone(to);
  if (!allowed && options?.replyToSender) {
    allowed = normalizeWhatsAppDigits(options.replyToSender) === to;
  }
  if (!allowed) {
    try {
      allowed = (await recentInboundSenders()).has(to);
    } catch {
      allowed = false;
    }
  }
  if (!allowed) {
    return {
      ok: false,
      to,
      error: "recipient not allowed: only the instructor allowlist or a sender who messaged within 24h",
    };
  }

  const now = Date.now();
  const recent = (sentLog.get(to) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    sentLog.set(to, recent);
    return { ok: false, to, error: `rate limit: max ${MAX_PER_WINDOW} media messages per hour per recipient` };
  }
  recent.push(now);
  sentLog.set(to, recent);
  return { ok: true, to };
}
