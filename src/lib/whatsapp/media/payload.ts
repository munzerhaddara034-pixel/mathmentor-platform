/**
 * Meta Cloud API message payloads for media. Dependency-free (unit-tested).
 */
import type { MediaCategory } from "./policy";

export type MediaRef = { id: string } | { link: string };

export type MediaMessageInput = {
  to: string;
  type: MediaCategory;
  media: MediaRef;
  caption?: string;
  filename?: string;
  /** Reply-quote the inbound message (context.message_id). */
  replyToMessageId?: string;
};

type MediaObject = { id?: string; link?: string; caption?: string; filename?: string };

export type MetaMediaMessagePayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: MediaCategory;
  context?: { message_id: string };
} & Partial<Record<MediaCategory, MediaObject>>;

/** WhatsApp caption limit is 1024 chars. */
export const MAX_CAPTION_CHARS = 1024;

export function buildMediaMessagePayload(input: MediaMessageInput): MetaMediaMessagePayload {
  const obj: MediaObject = "id" in input.media ? { id: input.media.id } : { link: input.media.link };
  // Meta rejects captions on audio; filename only applies to documents.
  if (input.caption && input.type !== "audio") obj.caption = input.caption.slice(0, MAX_CAPTION_CHARS);
  if (input.type === "document" && input.filename) obj.filename = input.filename.slice(0, 240);
  const payload: MetaMediaMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to.replace(/[^\d]/g, ""),
    type: input.type,
    [input.type]: obj,
  };
  if (input.replyToMessageId) payload.context = { message_id: input.replyToMessageId };
  return payload;
}
