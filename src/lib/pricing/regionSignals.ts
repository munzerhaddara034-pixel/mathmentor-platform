/**
 * Server-side pricing-region resolution (pure; unit-tested). The browser NEVER decides the price:
 *
 *   (a) location — the region the browser computed from geolocation (a client CLAIM; see geoRegion.ts).
 *       Required: prices are shown / sold only after the student enabled location.
 *   (b) ip       — the visitor's IP country from a TRUSTED edge header (see ipCountryFromHeaders).
 *   (c) phone    — the country calling code of the phone on file (+961, GCC codes, +1 …).
 *
 * All available signals must agree. If they do not, the MOST EXPENSIVE region among them wins and the
 * order is flagged for the owner's review. Only region names, the source names and the flag are kept:
 * never coordinates, never the IP address.
 */
import { PRICING_REGIONS, getRegionalPricing, isPricingRegion, type PricingRegion } from "./plans";

export const REGION_SOURCES = ["location", "ip", "phone"] as const;
export type RegionSource = (typeof REGION_SOURCES)[number];

/** Region named by each source that was available (region names only). */
export type RegionSignals = Partial<Record<RegionSource, PricingRegion>>;

export type RegionResolution =
  | { ok: true; region: PricingRegion; sources: RegionSignals; mismatch: boolean }
  | { ok: false; reason: "location_required"; sources: RegionSignals };

export const GCC_COUNTRIES = ["SA", "AE", "KW", "QA", "BH", "OM"] as const;

/** ISO-3166 alpha-2 → region. Unknown / special codes (XX, T1, EU …) → null (no signal). */
export function regionFromCountry(code: string | null | undefined): PricingRegion | null {
  const cc = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc) || cc === "XX" || cc === "T1" || cc === "EU" || cc === "AP") return null;
  if (cc === "LB") return "lebanon";
  if ((GCC_COUNTRIES as readonly string[]).includes(cc)) return "gcc";
  if (cc === "US") return "admissions_us";
  return "international";
}

/**
 * Which request header carries a trustworthy IP country:
 *  - MM_IP_COUNTRY_HEADER set → that header ("off" / "none" disables the IP signal);
 *  - else on Render (RENDER=true) → "cf-ipcountry": every Render service sits behind Cloudflare, which
 *    overwrites CF-IPCountry at its edge, so a client cannot inject it;
 *  - else none (local dev / unknown hosts): a client-sent country header would be spoofable.
 */
export function trustedCountryHeader(env: Record<string, string | undefined> = process.env): string | null {
  const configured = env.MM_IP_COUNTRY_HEADER?.trim().toLowerCase();
  if (configured) return configured === "off" || configured === "none" ? null : configured;
  if (env.RENDER === "true") return "cf-ipcountry";
  return null;
}

export function ipCountryFromHeaders(
  headers: { get(name: string): string | null },
  env: Record<string, string | undefined> = process.env,
): string | null {
  const name = trustedCountryHeader(env);
  if (!name) return null;
  const value = headers.get(name)?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

/**
 * Calling code → candidate regions. +1 is shared by the US, Canada and the Caribbean, so it is
 * compatible with either "admissions_us" or "international" (it alone never causes a mismatch).
 */
export function phoneRegionCandidates(phone: string | null | undefined): PricingRegion[] | null {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (!digits.startsWith("+") || digits.length < 9) return null;
  const n = digits.slice(1);
  if (n.startsWith("961")) return ["lebanon"];
  if (["966", "971", "965", "974", "973", "968"].some((code) => n.startsWith(code))) return ["gcc"];
  if (n.startsWith("1")) return ["admissions_us", "international"];
  return ["international"];
}

/** Price rank of a region (higher = more expensive): sum of its monthly plan charges in plans.ts. */
export function regionCostRank(region: PricingRegion): number {
  return getRegionalPricing(region).plans.reduce((sum, plan) => sum + plan.defaultChargeUSD, 0);
}

export function mostExpensiveRegion(regions: PricingRegion[]): PricingRegion {
  return [...regions].sort((a, b) => regionCostRank(b) - regionCostRank(a))[0];
}

export function resolvePricingRegion(input: {
  location?: unknown;
  ipCountry?: string | null;
  phone?: string | null;
}): RegionResolution {
  const location = isPricingRegion(input.location) ? input.location : null;
  const ip = regionFromCountry(input.ipCountry);
  const phoneCandidates = phoneRegionCandidates(input.phone);

  const candidateSets: PricingRegion[][] = [];
  const sources: RegionSignals = {};
  if (location) {
    sources.location = location;
    candidateSets.push([location]);
  }
  if (ip) {
    sources.ip = ip;
    candidateSets.push([ip]);
  }
  if (phoneCandidates) candidateSets.push(phoneCandidates);

  // Agreement = some region is compatible with every signal.
  const agreed = PRICING_REGIONS.filter((region) => candidateSets.every((set) => set.includes(region)));
  if (phoneCandidates) {
    const fromLocationOrIp = agreed.length ? agreed : [location, ip].filter((r): r is PricingRegion => Boolean(r));
    const pick = phoneCandidates.find((r) => fromLocationOrIp.includes(r));
    // Report the phone's own region: the agreed one for ambiguous +1, else its most expensive candidate.
    sources.phone = pick ?? mostExpensiveRegion(phoneCandidates);
  }

  if (!location) return { ok: false, reason: "location_required", sources };

  if (agreed.length) return { ok: true, region: mostExpensiveRegion(agreed), sources, mismatch: false };
  const named = REGION_SOURCES.map((source) => sources[source]).filter((r): r is PricingRegion => Boolean(r));
  return { ok: true, region: mostExpensiveRegion(named), sources, mismatch: true };
}

/** Sources that named a region, in a fixed order (for storage / display). */
export function regionSourceList(sources: RegionSignals): RegionSource[] {
  return REGION_SOURCES.filter((source) => Boolean(sources[source]));
}

/** Sanitise stored / incoming signals: only known sources with known region names survive. */
export function sanitizeRegionSignals(value: unknown): RegionSignals {
  const out: RegionSignals = {};
  if (!value || typeof value !== "object") return out;
  for (const source of REGION_SOURCES) {
    const region = (value as Record<string, unknown>)[source];
    if (isPricingRegion(region)) out[source] = region;
  }
  return out;
}

/** Convenience for route handlers: signals from the request + the signed-in user's phone on file. */
export function resolveRegionForRequest(input: {
  location: unknown;
  headers: { get(name: string): string | null };
  phone?: string | null;
  env?: Record<string, string | undefined>;
}): RegionResolution {
  return resolvePricingRegion({
    location: input.location,
    ipCountry: ipCountryFromHeaders(input.headers, input.env),
    phone: input.phone ?? null,
  });
}
