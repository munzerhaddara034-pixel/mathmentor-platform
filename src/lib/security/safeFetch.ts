/**
 * SSRF guard for server-side fetches of caller-supplied URLs (e.g. a voice-note mediaUrl).
 * - https only, default port, no credentials in the URL;
 * - host must be the platform's own host or an allow-listed provider host (WhatsApp / Meta CDN,
 *   Twilio, UltraMsg) — extend with MEDIA_FETCH_ALLOWED_HOSTS (comma-separated, exact or ".suffix");
 * - every resolved address must be public (no loopback, private, link-local, CGNAT, metadata, ULA…);
 * - redirects are followed manually (max 3), each hop re-validated; size and time capped.
 * Pure helpers are exported for unit tests.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export const PLATFORM_HOSTS = ["mathmentor-platform.onrender.com"];

/** Provider hosts that legitimately serve inbound media. Entries starting with "." match subdomains. */
export const PROVIDER_MEDIA_HOSTS = [
  "lookaside.fbsbx.com",
  "graph.facebook.com",
  ".whatsapp.net",
  ".fbcdn.net",
  "api.twilio.com",
  "media.twiliocdn.com",
  ".twiliocdn.com",
  "api.ultramsg.com",
  ".ultramsg.com",
];

export function allowedMediaHosts(env: Record<string, string | undefined> = process.env): string[] {
  const hosts = [...PLATFORM_HOSTS, ...PROVIDER_MEDIA_HOSTS];
  for (const value of [env.NEXT_PUBLIC_APP_URL, env.APP_URL]) {
    if (!value) continue;
    try {
      hosts.push(new URL(value).hostname.toLowerCase());
    } catch {
      /* ignore malformed */
    }
  }
  for (const extra of (env.MEDIA_FETCH_ALLOWED_HOSTS || "").split(",")) {
    const host = extra.trim().toLowerCase();
    if (host) hosts.push(host);
  }
  return [...new Set(hosts)];
}

export function hostMatches(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return allowed.some((entry) => (entry.startsWith(".") ? h.endsWith(entry) && h.length > entry.length : h === entry));
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16", // link-local incl. 169.254.169.254 cloud metadata
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

/** True for any address a server-side fetch must never reach. */
export function isBlockedAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return BLOCKED_V4.some((cidr) => inV4(address, cidr));
  if (kind !== 6) return true;
  const ip = address.toLowerCase();
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedAddress(mapped[1]);
  if (ip === "::" || ip === "::1") return true;
  const first = parseInt(ip.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local (incl. fd00:ec2::254 metadata)
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (ip.startsWith("64:ff9b:") || ip.startsWith("2001:db8:") || ip.startsWith("100::")) return true;
  return false;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Pure: scheme / port / credentials / host allow-list / IP-literal checks (no DNS). */
export function checkFetchUrl(raw: string, allowed: string[] = allowedMediaHosts()): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "https_only" };
  if (url.username || url.password) return { ok: false, reason: "credentials_in_url" };
  if (url.port && url.port !== "443") return { ok: false, reason: "port_not_allowed" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return { ok: false, reason: "ip_literal_not_allowed" };
  if (!hostMatches(host, allowed)) return { ok: false, reason: "host_not_allowed" };
  return { ok: true, url };
}

export type LookupFn = (host: string) => Promise<Array<{ address: string }>>;

const defaultLookup: LookupFn = (host) => dnsLookup(host, { all: true, verbatim: true });

export class BlockedFetchError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`blocked fetch: ${reason}`);
    this.name = "BlockedFetchError";
    this.reason = reason;
  }
}

/** Validate URL + DNS (every resolved address must be public). Throws BlockedFetchError. */
export async function assertSafeFetchTarget(raw: string, opts: { allowed?: string[]; lookup?: LookupFn } = {}): Promise<URL> {
  const check = checkFetchUrl(raw, opts.allowed);
  if (!check.ok) throw new BlockedFetchError(check.reason);
  const addresses = await (opts.lookup ?? defaultLookup)(check.url.hostname).catch(() => []);
  if (!addresses.length) throw new BlockedFetchError("dns_failed");
  if (addresses.some((item) => isBlockedAddress(item.address))) throw new BlockedFetchError("private_address");
  return check.url;
}

/**
 * Fetch an allow-listed https URL with SSRF checks on every redirect hop, a timeout and a size cap.
 * Returns the bytes and content type.
 */
export async function safeFetchBytes(
  raw: string,
  opts: { maxBytes?: number; timeoutMs?: number; allowed?: string[]; lookup?: LookupFn; fetchImpl?: typeof fetch; headers?: Record<string, string> } = {},
): Promise<{ bytes: Buffer; contentType: string }> {
  const maxBytes = opts.maxBytes ?? 16 * 1024 * 1024;
  const fetchImpl = opts.fetchImpl ?? fetch;
  let current = raw;
  for (let hop = 0; hop <= 3; hop += 1) {
    const url = await assertSafeFetchTarget(current, opts);
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      headers: opts.headers,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new BlockedFetchError("redirect_without_location");
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new BlockedFetchError(`http_${response.status}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new BlockedFetchError("too_large");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new BlockedFetchError("too_large");
    return { bytes, contentType: response.headers.get("content-type") || "application/octet-stream" };
  }
  throw new BlockedFetchError("too_many_redirects");
}
