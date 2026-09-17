import { appendWhatsAppMessage } from "./store";
import type { WhatsAppKind, WhatsAppMessage, WhatsAppProvider } from "./types";

export function configuredWhatsAppProvider(): WhatsAppProvider {
  const named = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (named === "twilio" || named === "ultramsg") return named;
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
  return false;
}

export function toE164(phone: string) {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `961${digits}`;
  if (digits.length === 7) digits = `961${digits}`;
  return digits ? `+${digits}` : "";
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

export async function sendWhatsApp(input: {
  to: string;
  body: string;
  bodyAr?: string;
  kind: WhatsAppKind;
  relatedId?: string;
}): Promise<WhatsAppMessage> {
  const to = toE164(input.to);
  const text = input.bodyAr ? `${input.body}\n\n${input.bodyAr}` : input.body;
  const provider = configuredWhatsAppProvider();
  const canSend = to && whatsappConfigured();

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

export function teacherWhatsApp() {
  return (
    process.env.TEACHER_WHATSAPP?.trim() ||
    process.env.ACADEMY_WHATSAPP?.trim() ||
    "96176532421"
  );
}
