import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { pgGetDocument, pgSetDocument } from "./db/documents";
import { isPostgresEnabled, withTransaction } from "./db/pg";

/**
 * JSON store resolution order: test override → Postgres (DATABASE_URL) → Netlify Blobs → data/ files.
 */

/** Site-scoped Netlify Blobs store. Keys are JSON filenames (`auth.json`, …). */
export const NETLIFY_BLOBS_STORE_NAME = "mathmentor-data";

type BlobsJsonStore = {
  get: (key: string, options: { type: "json" }) => Promise<unknown>;
  setJSON: (key: string, value: unknown) => Promise<unknown>;
};

type JsonBackend = {
  getJSON: (key: string) => Promise<unknown | null>;
  setJSON: (key: string, value: unknown) => Promise<void>;
};

const fileLocks = new Map<string, Promise<unknown>>();

/**
 * Documents locked by the current async call chain (see withDocumentLock). On Postgres `client` is the
 * open transaction holding the advisory + row locks: reads/writes of the locked keys go through it.
 */
type DocumentLockContext = { keys: ReadonlySet<string>; client: PoolClient | null };
const documentLocks = new AsyncLocalStorage<DocumentLockContext>();
let blobsStorePromise: Promise<BlobsJsonStore | null> | undefined;
let blobsGaveUp = false;
let backendOverride: JsonBackend | null = null;

/** Netlify Functions / AWS Lambda can only persist local files under /tmp. */
export function isServerlessRuntime() {
  return Boolean(
    process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NETLIFY_DEV === "true",
  );
}

/**
 * Use Netlify Blobs on deployed / `netlify dev` runtimes.
 * Local `next dev` / `next start` keep the gitignored `data/` folder.
 * `next build` skips Blobs because the API is not available at compile time.
 */
export function shouldUseNetlifyBlobs() {
  if (backendOverride) return true;
  if (blobsGaveUp) return false;
  if (process.env.NETLIFY_BLOBS_DISABLED === "1") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return isServerlessRuntime();
}

export function platformDataDir() {
  if (isServerlessRuntime()) return "/tmp/mathmentor-data";
  return path.join(process.cwd(), "data");
}

export function dataFile(name: string) {
  return path.join(platformDataDir(), blobKey(name));
}

export async function ensureDataDir() {
  await mkdir(platformDataDir(), { recursive: true });
  return platformDataDir();
}

function blobKey(name: string) {
  return path.basename(name);
}

function isBlobsConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /not been configured to use Netlify Blobs|MissingBlobsEnvironmentError/i.test(message);
}

async function loadBlobsStore(): Promise<BlobsJsonStore | null> {
  if (!shouldUseNetlifyBlobs() || backendOverride) return null;
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: NETLIFY_BLOBS_STORE_NAME, consistency: "strong" }) as BlobsJsonStore;
  } catch (error) {
    if (isBlobsConfigError(error)) {
      console.warn("[mathmentor] Netlify Blobs is not configured; JSON stores will use the local filesystem.");
      blobsGaveUp = true;
      return null;
    }
    console.error("[mathmentor] Failed to open Netlify Blobs store.", error);
    blobsGaveUp = true;
    return null;
  }
}

async function blobsStore(): Promise<BlobsJsonStore | null> {
  if (!shouldUseNetlifyBlobs() || backendOverride) return null;
  blobsStorePromise ??= loadBlobsStore();
  return blobsStorePromise;
}

async function filesystemBackend(): Promise<JsonBackend> {
  await ensureDataDir();
  return {
    async getJSON(key) {
      try {
        const raw = await readFile(dataFile(key), "utf8");
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    },
    async setJSON(key, value) {
      await ensureDataDir();
      await writeFile(dataFile(key), JSON.stringify(value, null, 2), "utf8");
    },
  };
}

/**
 * Postgres (Neon) document backend — used whenever DATABASE_URL is set.
 * First read of a key that is missing in Postgres imports an existing local data/<key>
 * file once (set PG_IMPORT_LOCAL_FILES=0 to disable), so local data migrates transparently.
 */
function postgresBackend(): JsonBackend {
  return {
    async getJSON(key) {
      const client = lockedClientFor(key);
      if (client) return txGetJSON(client, key);
      const data = await pgGetDocument(key);
      if (data != null) return data;
      if (process.env.PG_IMPORT_LOCAL_FILES === "0") return null;
      let local: unknown = null;
      try {
        local = JSON.parse(await readFile(dataFile(key), "utf8")) as unknown;
      } catch {
        local = null;
      }
      if (local == null) return null;
      await pgSetDocument(key, local);
      return local;
    },
    async setJSON(key, value) {
      const client = lockedClientFor(key);
      if (client) return txSetJSON(client, key, value);
      await pgSetDocument(key, value);
    },
  };
}

/** The open Postgres transaction of the current withDocumentLock scope (null on file / Blobs backends). */
export function currentDocumentTransaction(): PoolClient | null {
  return documentLocks.getStore()?.client ?? null;
}

/** The transaction client when `key` is locked by the current call chain on Postgres. */
function lockedClientFor(key: string): PoolClient | null {
  const context = documentLocks.getStore();
  return context?.client && context.keys.has(key) ? context.client : null;
}

async function txGetJSON(client: PoolClient, key: string): Promise<unknown | null> {
  const result = await client.query<{ data: unknown }>("SELECT data FROM mm_documents WHERE key = $1", [key]);
  if (result.rows.length && result.rows[0].data != null) return result.rows[0].data;
  if (process.env.PG_IMPORT_LOCAL_FILES === "0") return null;
  let local: unknown = null;
  try {
    local = JSON.parse(await readFile(dataFile(key), "utf8")) as unknown;
  } catch {
    local = null;
  }
  if (local == null) return null;
  await txSetJSON(client, key, local);
  return local;
}

async function txSetJSON(client: PoolClient, key: string, value: unknown): Promise<void> {
  await client.query(
    `INSERT INTO mm_documents (key, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [key, JSON.stringify(value ?? null)],
  );
}

async function blobsBackend(store: BlobsJsonStore): Promise<JsonBackend> {
  return {
    async getJSON(key) {
      const data = await store.get(key, { type: "json" });
      return data ?? null;
    },
    async setJSON(key, value) {
      await store.setJSON(key, value);
    },
  };
}

export async function resolveJsonBackend(): Promise<"postgres" | "blobs" | "filesystem"> {
  if (backendOverride) return "blobs";
  if (isPostgresEnabled()) return "postgres";
  const store = await blobsStore();
  return store ? "blobs" : "filesystem";
}

/**
 * Test-only hook: inject an in-memory JSON backend (simulates a shared Blobs store).
 * Pass `null` to restore the default filesystem / Blobs resolution.
 */
export function setPersistentStoreOverride(store: JsonBackend | null) {
  backendOverride = store;
  blobsGaveUp = false;
  blobsStorePromise = undefined;
}

async function activeBackend(): Promise<JsonBackend> {
  if (backendOverride) return backendOverride;
  if (isPostgresEnabled()) return postgresBackend();
  const store = await blobsStore();
  if (store) {
    try {
      return await blobsBackend(store);
    } catch (error) {
      if (!isBlobsConfigError(error)) throw error;
      console.warn("[mathmentor] Netlify Blobs operations failed; falling back to filesystem JSON.");
      blobsGaveUp = true;
      blobsStorePromise = undefined;
    }
  }
  return filesystemBackend();
}

/** In-process mutex for one store key (re-entrant inside withDocumentLock for the same key). */
export async function withStoreLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const key = blobKey(name);
  if (documentLocks.getStore()?.keys.has(key)) return fn();
  return acquireProcessLock(key, fn);
}

async function acquireProcessLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = fileLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = previous.then(() => gate, () => gate);
  fileLocks.set(key, current);
  try {
    await previous;
    return await fn();
  } finally {
    release();
    if (fileLocks.get(key) === current) fileLocks.delete(key);
  }
}

/** Stable 64-bit advisory-lock id per document key (namespaced so it never meets other lock ids). */
export const DOCUMENT_ADVISORY_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtextextended('mm_documents:' || $1, 0))";

/**
 * Atomic read-modify-write over one or more JSON documents.
 * - Every backend: an in-process mutex per key (keys taken in sorted order, so no lock-order cycles).
 * - Postgres (DATABASE_URL): ONE transaction that takes pg_advisory_xact_lock on each key (works even
 *   when the row does not exist yet) plus SELECT … FOR UPDATE on the existing document row (so it also
 *   excludes code that row-locks mm_documents directly, e.g. payment confirmation). Every readJsonFile /
 *   writeJsonFile / updateJsonFile of a locked key inside `fn` runs on that transaction, so all writes
 *   commit together or roll back together when `fn` throws.
 * Re-entrant: nested calls for keys already held run inline; new keys join the same transaction.
 * Keep network calls out of `fn` — the transaction holds a pooled connection.
 */
export async function withDocumentLock<T>(names: string | string[], fn: () => Promise<T>): Promise<T> {
  const wanted = [...new Set((Array.isArray(names) ? names : [names]).map(blobKey))].sort();
  const outer = documentLocks.getStore();
  const missing = wanted.filter((key) => !outer?.keys.has(key));
  if (!missing.length) return fn();
  const usePg = !backendOverride && isPostgresEnabled();

  const lockInProcess = (index: number, inner: () => Promise<T>): Promise<T> =>
    index >= missing.length ? inner() : acquireProcessLock(missing[index], () => lockInProcess(index + 1, inner));

  return lockInProcess(0, async () => {
    const keys = new Set([...(outer?.keys ?? []), ...missing]);
    if (!usePg) return documentLocks.run({ keys, client: null }, fn);
    const lockRows = async (client: PoolClient) => {
      for (const key of missing) {
        await client.query(DOCUMENT_ADVISORY_LOCK_SQL, [key]);
        await client.query("SELECT 1 FROM mm_documents WHERE key = $1 FOR UPDATE", [key]);
      }
    };
    if (outer?.client) {
      await lockRows(outer.client);
      return documentLocks.run({ keys, client: outer.client }, fn);
    }
    return withTransaction(async (client) => {
      await lockRows(client);
      return documentLocks.run({ keys, client }, fn);
    });
  });
}

export async function readJsonFile<T>(name: string, fallback: T, options?: { persistFallback?: boolean }): Promise<T> {
  const key = blobKey(name);
  const persistFallback = options?.persistFallback !== false;
  try {
    const backend = await activeBackend();
    const data = await backend.getJSON(key);
    if (data == null) {
      if (persistFallback) await backend.setJSON(key, fallback);
      return fallback;
    }
    return data as T;
  } catch (error) {
    // Postgres errors must surface: silently writing to the ephemeral disk would lose data.
    if (backendOverride || isPostgresEnabled()) throw error;
    if (shouldUseNetlifyBlobs() && isBlobsConfigError(error)) {
      blobsGaveUp = true;
      blobsStorePromise = undefined;
      const fsBackend = await filesystemBackend();
      const data = await fsBackend.getJSON(key);
      if (data == null) {
        if (persistFallback) await fsBackend.setJSON(key, fallback);
        return fallback;
      }
      return data as T;
    }
    await ensureDataDir();
    try {
      const raw = await readFile(dataFile(key), "utf8");
      return JSON.parse(raw) as T;
    } catch {
      if (persistFallback) {
        await writeFile(dataFile(key), JSON.stringify(fallback, null, 2), "utf8");
      }
      return fallback;
    }
  }
}

export async function writeJsonFile<T>(name: string, data: T) {
  const key = blobKey(name);
  try {
    const backend = await activeBackend();
    await backend.setJSON(key, data);
  } catch (error) {
    // Postgres errors must surface: silently writing to the ephemeral disk would lose data.
    if (backendOverride || isPostgresEnabled()) throw error;
    if (shouldUseNetlifyBlobs() && isBlobsConfigError(error)) {
      blobsGaveUp = true;
      blobsStorePromise = undefined;
      const fsBackend = await filesystemBackend();
      await fsBackend.setJSON(key, data);
      return;
    }
    await ensureDataDir();
    await writeFile(dataFile(key), JSON.stringify(data, null, 2), "utf8");
  }
}

/**
 * Locked read-modify-write for one JSON store key (see withDocumentLock):
 * in-process mutex, plus on Postgres an advisory lock and SELECT … FOR UPDATE in one transaction,
 * so several instances can update the same document without losing writes.
 */
export async function updateJsonFile<T>(name: string, fallback: T, update: (current: T) => T | Promise<T>): Promise<T> {
  return withDocumentLock(name, async () => {
    const current = await readJsonFile<T>(name, fallback, { persistFallback: false });
    const next = await update(current);
    await writeJsonFile(name, next);
    return next;
  });
}
