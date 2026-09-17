import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { platformDataDir } from "@/lib/dataDir";
import { createId } from "@/lib/ids";
import type { WhatsAppMessage } from "./types";

const dataDir = platformDataDir();
const storePath = path.join(dataDir, "whatsapp-outbox.json");

type OutboxStore = { messages: WhatsAppMessage[] };

async function readOutbox(): Promise<OutboxStore> {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<OutboxStore>;
    return { messages: Array.isArray(parsed.messages) ? parsed.messages : [] };
  } catch {
    const initial: OutboxStore = { messages: [] };
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function writeOutbox(store: OutboxStore) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
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
