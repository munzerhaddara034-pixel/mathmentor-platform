import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import { createId } from "@/lib/ids";
import type { WhatsAppMessage } from "./types";

const STORE_FILE = "whatsapp-outbox.json";

type OutboxStore = { messages: WhatsAppMessage[] };

async function readOutbox(): Promise<OutboxStore> {
  const parsed = await readJsonFile<Partial<OutboxStore>>(STORE_FILE, { messages: [] });
  return { messages: Array.isArray(parsed.messages) ? parsed.messages : [] };
}

async function writeOutbox(store: OutboxStore) {
  await writeJsonFile(STORE_FILE, store);
}

export async function appendWhatsAppMessage(input: Omit<WhatsAppMessage, "id" | "createdAt"> & { id?: string }) {
  const store = await readOutbox();
  const next: WhatsAppMessage = {
    ...input,
    id: input.id || createId("wa"),
    createdAt: new Date().toISOString(),
  };
  store.messages.unshift(next);
  store.messages = store.messages.slice(0, 500);
  await writeOutbox(store);
  return next;
}

export async function listWhatsAppMessages(limit = 120) {
  const store = await readOutbox();
  return store.messages.slice(0, limit);
}
