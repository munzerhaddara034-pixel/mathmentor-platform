import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

export async function resolveJsonBackend(): Promise<"blobs" | "filesystem"> {
  if (backendOverride) return "blobs";
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

export async function withStoreLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const key = blobKey(name);
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
    if (backendOverride) throw error;
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
    if (backendOverride) throw error;
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
