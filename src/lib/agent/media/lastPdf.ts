/**
 * Latest PDF محمد sent to each WhatsApp number, so a bare «ابعتلي ياه PDF» can resend it.
 * In memory only (bounded, 12 h TTL): lost on restart / deploy, which is fine for a resend.
 */
import type { ReplyAttachment } from "@/lib/whatsapp/agentCore";

const LAST_PDF_TTL_MS = 12 * 60 * 60 * 1000;
const LAST_PDF_MAX = 50;
const lastPdfByNumber = new Map<string, { attachment: ReplyAttachment; at: number }>();

function digitsOf(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function rememberLastPdf(to: string, attachment: ReplyAttachment): void {
  const key = digitsOf(to);
  if (!key) return;
  lastPdfByNumber.delete(key);
  lastPdfByNumber.set(key, { attachment, at: Date.now() });
  while (lastPdfByNumber.size > LAST_PDF_MAX) {
    const oldest = lastPdfByNumber.keys().next();
    if (oldest.done) break;
    lastPdfByNumber.delete(oldest.value);
  }
}

export function recallLastPdf(to: string): ReplyAttachment | undefined {
  const key = digitsOf(to);
  const hit = lastPdfByNumber.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > LAST_PDF_TTL_MS) {
    lastPdfByNumber.delete(key);
    return undefined;
  }
  return hit.attachment;
}

