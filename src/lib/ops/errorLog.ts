/**
 * First-party error log: the layer that makes the platform fail loudly instead of silently.
 *
 * This module is the pure core — types, scrubbing, fingerprints, merging and summaries — and it imports
 * nothing runtime-specific, so the Next.js `onRequestError` hook (which is also compiled for the edge
 * runtime) can call it safely. Persistence lives in `./errorLogStore`, a Node-only adapter registered at
 * startup, and the admin view is `/admin/ops`.
 *
 * Unhandled server errors are grouped by fingerprint so a repeating failure stays one line with a counter.
 * Every message is scrubbed of e-mail addresses, phone numbers and token-like strings before it is stored,
 * and no request body, header or stack trace is kept.
 */
export const OPS_ERRORS_MAX = 200;
const MESSAGE_MAX = 400;
const MERGE_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type OpsErrorEntry = {
  id: string;
  fingerprint: string;
  message: string;
  source: string;
  route: string;
  method: string;
  status: number;
  count: number;
  firstAt: string;
  lastAt: string;
};

export type OpsErrorInput = {
  message: string;
  source?: string;
  route?: string;
  method?: string;
  status?: number;
  now?: Date;
};

export type OpsErrorSummary = {
  total: number;
  entries: number;
  last24h: number;
  last7d: number;
  bySource: Array<{ source: string; count: number }>;
  top: OpsErrorEntry[];
};

/** Persistence boundary: implemented by the Node adapter, absent on the edge runtime. */
export type OpsErrorStore = {
  read(): Promise<OpsErrorEntry[]>;
  update(mutate: (entries: OpsErrorEntry[]) => OpsErrorEntry[]): Promise<OpsErrorEntry[]>;
};

let store: OpsErrorStore | null = null;

/** Called by `./errorLogStore` at startup (Node only). Passing null detaches it again (tests). */
export function setOpsErrorStore(next: OpsErrorStore | null): void {
  store = next;
}

export function isOpsErrorStoreReady(): boolean {
  return store !== null;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
const TOKEN = /[A-Za-z0-9_-]{24,}/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const QUERY = /\?[^\s"']*/g;

/** Removes what must never be stored: addresses, phone numbers, token-like strings and query strings. */
export function scrubErrorText(value: string): string {
  return String(value ?? "")
    .replace(EMAIL, "[email]")
    .replace(TOKEN, "[token]")
    .replace(PHONE, "[phone]")
    .replace(QUERY, "?[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MESSAGE_MAX);
}

/** Deterministic 32-bit pair (FNV-1a + mixing), hex. Fingerprints group failures; they are not a boundary. */
export function shortHash(input: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0");
}

/** Groups the same failure across ids and numbers into one fingerprint. */
export function errorFingerprint(source: string, message: string): string {
  const normalized = `${source}|${message.toLowerCase().replace(/[0-9a-f]{8,}/g, "#").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 200)}`;
  return shortHash(normalized);
}

/** Normalises one input into the row that will be stored. */
export function buildOpsErrorEntry(input: OpsErrorInput): OpsErrorEntry | null {
  const message = scrubErrorText(input.message || "Unknown error");
  if (!message) return null;
  const source = scrubErrorText(input.source ?? "server").slice(0, 40);
  const route = scrubErrorText(input.route ?? "").slice(0, 120);
  const method = String(input.method ?? "").toUpperCase().slice(0, 10);
  const status = Number.isFinite(input.status) ? Number(input.status) : 0;
  const now = input.now ?? new Date();
  const at = now.toISOString();
  const fingerprint = errorFingerprint(source, message);
  return { id: `${fingerprint}-${now.getTime().toString(36)}`, fingerprint, message, source, route, method, status, count: 1, firstAt: at, lastAt: at };
}

/**
 * Merge rule: the same fingerprint inside a 24-hour window increments the existing row, otherwise the new
 * row is prepended and the list is trimmed to {@link OPS_ERRORS_MAX}.
 */
export function mergeOpsError(entries: OpsErrorEntry[], entry: OpsErrorEntry, now: Date): OpsErrorEntry[] {
  const index = entries.findIndex((current) => current.fingerprint === entry.fingerprint && now.getTime() - Date.parse(current.lastAt) < MERGE_WINDOW_MS);
  if (index < 0) return [entry, ...entries].slice(0, OPS_ERRORS_MAX);
  const previous = entries[index];
  const merged: OpsErrorEntry = {
    ...previous,
    count: previous.count + 1,
    lastAt: entry.lastAt,
    status: entry.status || previous.status,
    route: entry.route || previous.route,
  };
  const next = [...entries];
  next[index] = merged;
  return next;
}

export function normalizeOpsErrors(raw: unknown): OpsErrorEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is OpsErrorEntry => Boolean(item) && typeof item === "object" && typeof (item as OpsErrorEntry).fingerprint === "string");
}

/**
 * Records one failure. A storage failure returns null instead of throwing — logging must never break the
 * request it is describing.
 */
export async function recordOpsError(input: OpsErrorInput): Promise<OpsErrorEntry | null> {
  const entry = buildOpsErrorEntry(input);
  if (!entry || !store) return null;
  const now = input.now ?? new Date();
  try {
    let saved: OpsErrorEntry | null = null;
    await store.update((entries) => {
      const next = mergeOpsError(entries, entry, now);
      saved = next.find((row) => row.fingerprint === entry.fingerprint) ?? null;
      return next;
    });
    return saved;
  } catch {
    return null;
  }
}

/** The Next.js hook's shape: an unknown thrown value plus request/context hints. */
export type RequestLike = { path?: string; method?: string };
export type RequestContextLike = { routerKind?: string; routePath?: string; routeType?: string };

/** Entry point for `onRequestError`; stores the error name/message (and digest) — never the stack. */
export async function recordRequestError(error: unknown, request?: RequestLike, context?: RequestContextLike): Promise<OpsErrorEntry | null> {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : "Unknown error";
  const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  return recordOpsError({
    message: digest ? `${message} (${digest})` : message,
    source: context?.routeType ?? context?.routerKind ?? "server",
    route: context?.routePath ?? request?.path ?? "",
    method: request?.method ?? "",
  });
}

/** Newest first. */
export async function listOpsErrors(limit = 50): Promise<OpsErrorEntry[]> {
  if (!store) return [];
  try {
    const entries = await store.read();
    return entries.slice(0, Math.max(1, Math.min(Math.round(limit) || 50, OPS_ERRORS_MAX)));
  } catch {
    return [];
  }
}

/**
 * Counters are approximate by design: merged entries keep one row per fingerprint, so the windows sum the
 * per-entry counters by their last-seen time instead of pretending to be exact event history.
 */
export async function errorSummary(now: Date = new Date()): Promise<OpsErrorSummary> {
  const errors = await listOpsErrors(OPS_ERRORS_MAX);
  const within = (entry: OpsErrorEntry, windowMs: number) => now.getTime() - Date.parse(entry.lastAt) < windowMs;
  const bySource = new Map<string, number>();
  for (const entry of errors) bySource.set(entry.source, (bySource.get(entry.source) ?? 0) + entry.count);
  return {
    total: errors.reduce((sum, entry) => sum + entry.count, 0),
    entries: errors.length,
    last24h: errors.filter((entry) => within(entry, DAY_MS)).reduce((sum, entry) => sum + entry.count, 0),
    last7d: errors.filter((entry) => within(entry, 7 * DAY_MS)).reduce((sum, entry) => sum + entry.count, 0),
    bySource: [...bySource.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    top: [...errors].sort((a, b) => b.count - a.count || Date.parse(b.lastAt) - Date.parse(a.lastAt)).slice(0, 5),
  };
}

/** Empties the log and returns how many rows were removed. */
export async function clearOpsErrors(): Promise<number> {
  if (!store) return 0;
  try {
    let removed = 0;
    await store.update((entries) => {
      removed = entries.length;
      return [];
    });
    return removed;
  } catch {
    return 0;
  }
}