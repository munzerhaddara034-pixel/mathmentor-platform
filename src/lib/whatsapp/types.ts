export const WHATSAPP_PROVIDERS = ["twilio", "ultramsg", "log"] as const;
export type WhatsAppProvider = (typeof WHATSAPP_PROVIDERS)[number];

export const WHATSAPP_KINDS = ["live_reminder", "activation", "video_ready"] as const;
export type WhatsAppKind = (typeof WHATSAPP_KINDS)[number];

export type WhatsAppStatus = "logged" | "sent" | "failed";

export type WhatsAppMessage = {
  id: string;
  createdAt: string;
  to: string;
  body: string;
  bodyAr?: string;
  kind: WhatsAppKind;
  relatedId?: string;
  status: WhatsAppStatus;
  provider: WhatsAppProvider;
  error?: string;
};
