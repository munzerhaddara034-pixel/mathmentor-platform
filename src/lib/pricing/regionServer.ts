/**
 * Route-handler glue for the region lock — SERVER ONLY. Signals: the browser's geolocation claim
 * (region name only; coordinates never leave the device), the offline IP country and the phone on file.
 */
import { ipCountryFromRequest } from "./ipCountry";
import { resolvePricingRegion, type RegionResolution } from "./regionSignals";

export function resolveRegionForRequest(input: {
  location: unknown;
  headers: { get(name: string): string | null };
  phone?: string | null;
  env?: Record<string, string | undefined>;
}): RegionResolution {
  return resolvePricingRegion({
    location: input.location,
    ipCountry: ipCountryFromRequest(input.headers, input.env),
    phone: input.phone ?? null,
  });
}
