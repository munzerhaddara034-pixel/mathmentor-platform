/**
 * IP country for the pricing-region decision — SERVER ONLY (reads the bundled GeoIP database from disk).
 *
 * Render adds NO IP-country header, so the country is looked up OFFLINE with the `geoip-country`
 * package (pinned version; it ships MaxMind GeoLite2-Country data files inside node_modules, no network
 * call, no API key, no install-time download). "This product includes GeoLite2 Data created by MaxMind,
 * available from https://www.maxmind.com" (CC BY-SA 4.0). Refresh the data by bumping the package.
 *
 * Which header holds the client IP:
 *  - MM_IP_GEO=off                → IP signal disabled;
 *  - MM_CLIENT_IP_HEADER=<name>   → first entry of that header;
 *  - RENDER=true (set by Render)  → first entry of X-Forwarded-For (Render resets it so the first value
 *                                   is the real client address);
 *  - otherwise (local dev)        → none: a client-sent header would be spoofable.
 * The IP address itself is never stored or logged; only the resulting region name is.
 */
import { createRequire } from "node:module";
import { isIP } from "node:net";

type GeoIpLookup = { lookup(ip: string): { country?: string } | null };

let geoip: GeoIpLookup | null | undefined;

function loadGeoIp(): GeoIpLookup | null {
  if (geoip !== undefined) return geoip;
  try {
    const require = createRequire(import.meta.url);
    geoip = require("geoip-country") as GeoIpLookup;
  } catch {
    geoip = null; // database missing → no IP signal (location + phone still decide)
  }
  return geoip;
}

export function clientIpHeaderName(env: Record<string, string | undefined> = process.env): string | null {
  if (env.MM_IP_GEO?.trim().toLowerCase() === "off") return null;
  const configured = env.MM_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (configured) return configured === "off" || configured === "none" ? null : configured;
  if (env.RENDER === "true") return "x-forwarded-for";
  return null;
}

export function clientIpForGeo(
  headers: { get(name: string): string | null },
  env: Record<string, string | undefined> = process.env,
): string | null {
  const name = clientIpHeaderName(env);
  if (!name) return null;
  let ip = (headers.get(name) ?? "").split(",")[0]?.trim() ?? "";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}

/** ISO-3166 alpha-2 country of an IP, or null (private / unknown address, DB unavailable). */
export function countryForIp(ip: string | null | undefined): string | null {
  if (!ip || !isIP(ip)) return null;
  const db = loadGeoIp();
  if (!db) return null;
  try {
    const country = db.lookup(ip)?.country?.toUpperCase() ?? "";
    return /^[A-Z]{2}$/.test(country) ? country : null;
  } catch {
    return null;
  }
}

export function ipCountryFromRequest(
  headers: { get(name: string): string | null },
  env: Record<string, string | undefined> = process.env,
): string | null {
  return countryForIp(clientIpForGeo(headers, env));
}
