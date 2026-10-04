/**
 * Persist WhatsApp media files (binary under data/whatsapp-media/) + JSON metadata
 * (`whatsapp-media.json` via the shared data store) so Agent Hub can list them.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { platformDataDir, readJsonFile, withDocumentLock, writeJsonFile } from "@/lib/dataDir";
import { createId } from "@/lib/ids";
import { safeFilename, type InboundMediaKind } from "./policy";

const META_FILE = "whatsapp-media.json";
const MAX_RECORDS = 300;

export type WhatsAppMediaStatus = "received" | "processed" | "failed" | "rejected" | "sent" | "logged";

export type WhatsAppMediaRecord = {
  id: string;
  direction: "inbound" | "outbound";
  kind: InboundMediaKind;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  /** File name inside data/whatsapp-media/ (absent when rejected / not stored). */
  storedName?: string;
  sha256?: string;
  from?: string;
  to?: string;
  caption?: string;
  provider?: string;
  waMediaId?: string;
  waMessageId?: string;
  action?: string;
  status: WhatsAppMediaStatus;
  note?: string;
  relatedIds: string[];
  createdAt: string;
  updatedAt: string;
};

type MediaStore = { files: WhatsAppMediaRecord[] };

export function mediaDir(): string {
  return path.join(platformDataDir(), "whatsapp-media");
}

async function readStore(): Promise<MediaStore> {
  const raw = await readJsonFile<Partial<MediaStore>>(META_FILE, { files: [] });
  return { files: Array.isArray(raw.files) ? raw.files : [] };
}

async function upsert(record: WhatsAppMediaRecord): Promise<WhatsAppMediaRecord> {
  return withDocumentLock(META_FILE, async () => {
    const store = await readStore();
    const index = store.files.findIndex((f) => f.id === record.id);
    if (index >= 0) store.files[index] = record;
    else store.files.unshift(record);
    store.files = store.files.slice(0, MAX_RECORDS);
    await writeJsonFile(META_FILE, store);
    return record;
  });
}

export type SaveMediaInput = Omit<WhatsAppMediaRecord, "id" | "storedName" | "sha256" | "sizeBytes" | "createdAt" | "updatedAt" | "relatedIds" | "filename"> & {
  filename?: string;
  bytes?: Buffer;
  sizeBytes?: number;
  relatedIds?: string[];
};

/** Store bytes (when given) + metadata. Never throws: a disk failure still records metadata. */
export async function saveMediaRecord(input: SaveMediaInput): Promise<WhatsAppMediaRecord> {
  const now = new Date().toISOString();
  const id = createId("wamedia");
  const filename = safeFilename(input.filename, input.mimeType);
  let storedName: string | undefined;
  let sha256: string | undefined;
  let note = input.note;
  if (input.bytes && input.bytes.length) {
    try {
      await mkdir(mediaDir(), { recursive: true });
      storedName = `${id}-${filename}`;
      await writeFile(path.join(mediaDir(), storedName), input.bytes);
      sha256 = createHash("sha256").update(input.bytes).digest("hex");
    } catch (error) {
      storedName = undefined;
      note = [note, `disk write failed: ${error instanceof Error ? error.message : "unknown"}`].filter(Boolean).join(" · ");
    }
  }
  const { bytes: _bytes, ...rest } = input;
  void _bytes;
  const record: WhatsAppMediaRecord = {
    ...rest,
    id,
    filename,
    storedName,
    sha256,
    note,
    sizeBytes: input.bytes?.length ?? input.sizeBytes ?? 0,
    relatedIds: input.relatedIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
  try {
    return await upsert(record);
  } catch (error) {
    console.warn("[mathmentor] whatsapp media metadata save failed:", error instanceof Error ? error.message : error);
    return record;
  }
}

export async function patchMediaRecord(
  id: string,
  patch: Partial<Omit<WhatsAppMediaRecord, "id" | "createdAt">>,
): Promise<WhatsAppMediaRecord | undefined> {
  try {
    return await withDocumentLock(META_FILE, async () => {
      const store = await readStore();
      const index = store.files.findIndex((f) => f.id === id);
      if (index < 0) return undefined;
      const next: WhatsAppMediaRecord = { ...store.files[index]!, ...patch, updatedAt: new Date().toISOString() };
      store.files[index] = next;
      await writeJsonFile(META_FILE, store);
      return next;
    });
  } catch {
    return undefined;
  }
}

export async function listMediaRecords(limit = 50): Promise<WhatsAppMediaRecord[]> {
  try {
    const store = await readStore();
    return store.files.slice(0, Math.max(1, Math.min(limit, MAX_RECORDS)));
  } catch {
    return [];
  }
}

export async function getMediaRecord(id: string): Promise<WhatsAppMediaRecord | undefined> {
  const store = await readStore();
  return store.files.find((f) => f.id === id);
}

/** Bytes of a stored file, or null when missing (e.g. wiped by an ephemeral-disk redeploy). */
export async function readMediaBytes(record: WhatsAppMediaRecord): Promise<Buffer | null> {
  if (!record.storedName) return null;
  const safe = path.basename(record.storedName);
  try {
    return await readFile(path.join(mediaDir(), safe));
  } catch {
    return null;
  }
}

/** Numbers that messaged us within `withinMs` (Meta 24h customer-service window). */
export async function recentInboundSenders(withinMs = 24 * 60 * 60 * 1000): Promise<Set<string>> {
  const cutoff = Date.now() - withinMs;
  const store = await readStore();
  const out = new Set<string>();
  for (const f of store.files) {
    // Only real provider webhooks count (staff test uploads cannot open a reply window).
    if (f.direction === "inbound" && f.from && f.provider !== "staff" && Date.parse(f.createdAt) >= cutoff) out.add(f.from);
  }
  return out;
}
