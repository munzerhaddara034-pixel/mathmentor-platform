/**
 * Coordinates → pricing region, computed IN THE BROWSER (pure, no imports, no network).
 * Raw coordinates never leave the device: the client sends only the resulting region name.
 *
 * Simplified outlines (accurate to a few km near borders — fine for pricing, and the server
 * cross-checks with IP country + phone anyway):
 *   - Lebanon: hand-traced polygon (excludes Damascus, the Golan and northern Israel).
 *   - GCC (SA, AE, KW, QA, BH, OM): one polygon around the six states (excludes Jordan, Iraq, Yemen, Iran, Sinai).
 *   - US: contiguous-48 polygon (excludes Canada south of 49°N, e.g. Toronto, and Mexico) + Alaska + Hawaii boxes.
 *   - Everything else: international.
 */
import type { PricingRegion } from "./plans";

/** [longitude, latitude] pairs. */
type Ring = ReadonlyArray<readonly [number, number]>;

export const LEBANON_RING: Ring = [
  [35.03, 33.08], [35.53, 33.08], [35.56, 33.28], [35.82, 33.28], [35.95, 33.43], [36.0, 33.56],
  [36.25, 33.8], [36.4, 34.0], [36.45, 34.2], [36.62, 34.5], [36.62, 34.66], [35.98, 34.7],
  [35.92, 34.7], [35.72, 34.47], [35.58, 34.25], [35.55, 34.0], [35.4, 33.92], [35.36, 33.7],
  [35.28, 33.56], [35.11, 33.27],
];

export const GCC_RING: Ring = [
  [34.8, 29.35], [36.07, 29.18], [36.5, 29.5], [36.75, 29.86], [37.5, 30.0], [38.0, 30.5], [37.0, 31.5],
  [39.2, 32.15], [40.4, 31.95], [42.1, 31.1], [44.7, 29.2], [46.55, 29.1], [47.45, 30.1], [48.0, 30.05],
  [48.5, 29.9], [49.5, 28.0], [50.8, 26.9], [51.3, 26.3], [51.75, 25.5], [51.75, 24.6], [52.6, 24.4],
  [54.0, 24.6], [55.5, 25.6], [56.1, 26.3], [56.5, 26.45], [56.6, 25.0], [57.8, 24.0], [58.9, 23.8],
  [59.95, 22.5], [58.9, 20.4], [57.9, 18.9], [56.8, 17.8], [55.2, 16.8], [53.1, 16.4], [52.0, 19.0],
  [49.1, 18.6], [46.3, 17.2], [44.2, 17.4], [43.3, 17.4], [42.7, 16.3], [42.2, 17.0], [41.3, 18.5],
  [38.9, 21.5], [37.8, 24.0], [36.4, 25.8], [35.0, 27.9], [34.6, 28.1],
];

export const US_CONTIGUOUS_RING: Ring = [
  // Canada border, west → east
  [-124.9, 48.4], [-123.2, 48.2], [-123.0, 49.0], [-95.15, 49.0], [-89.6, 48.0], [-84.8, 46.5],
  [-82.5, 45.3], [-82.4, 43.0], [-82.5, 42.6], [-82.95, 42.34], [-83.1, 42.28], [-83.13, 42.05], [-81.0, 42.2], [-78.9, 42.9],
  [-79.05, 43.27], [-78.0, 43.5], [-76.5, 43.65], [-76.3, 44.2], [-74.7, 45.0], [-71.5, 45.0],
  [-70.8, 45.4], [-70.0, 46.7], [-69.2, 47.45], [-68.2, 47.35], [-67.8, 47.07], [-67.8, 45.7],
  [-67.0, 45.0],
  // Atlantic + Gulf coast (offshore)
  [-66.5, 44.5], [-69.5, 43.5], [-69.8, 41.2], [-73.8, 40.2], [-74.0, 38.8], [-75.4, 35.2],
  [-76.5, 34.0], [-80.0, 32.0], [-80.0, 26.5], [-80.1, 25.0], [-81.2, 24.4], [-82.0, 24.4],
  [-82.8, 27.5], [-83.0, 29.0], [-84.5, 29.5], [-86.0, 30.2], [-88.5, 30.1], [-89.5, 28.9],
  [-91.0, 28.9], [-94.0, 29.4], [-97.0, 27.6], [-97.1, 25.95],
  // Mexico border, east → west
  [-97.4, 25.85], [-99.1, 26.4], [-99.5, 27.5], [-100.3, 28.3], [-101.4, 29.8], [-102.4, 29.8],
  [-103.1, 29.0], [-104.5, 29.6], [-106.0, 31.4], [-106.4, 31.74], [-106.53, 31.78], [-108.2, 31.78], [-108.2, 31.33], [-111.1, 31.33],
  [-114.8, 32.5], [-114.7, 32.72], [-117.12, 32.53],
  // Pacific coast (offshore)
  [-117.4, 32.5], [-118.6, 33.0], [-120.8, 34.3], [-122.6, 37.0], [-124.5, 40.3], [-124.6, 42.8],
  [-124.2, 46.2],
];

type Box = { minLat: number; maxLat: number; minLon: number; maxLon: number };
const US_EXTRA_BOXES: Box[] = [
  { minLat: 51.0, maxLat: 71.6, minLon: -179.9, maxLon: -141.0 }, // Alaska (west of the Yukon border)
  { minLat: 18.5, maxLat: 22.5, minLon: -160.6, maxLon: -154.5 }, // Hawaii
];

/** Ray casting; points exactly on an edge may land on either side (irrelevant at this precision). */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isValidCoordinate(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

/** Region for a coordinate pair. Invalid input → null (caller keeps prices hidden). */
export function regionFromCoordinates(lat: number, lon: number): PricingRegion | null {
  if (!isValidCoordinate(lat, lon)) return null;
  if (pointInRing(lon, lat, LEBANON_RING)) return "lebanon";
  if (pointInRing(lon, lat, GCC_RING)) return "gcc";
  if (pointInRing(lon, lat, US_CONTIGUOUS_RING)) return "admissions_us";
  if (US_EXTRA_BOXES.some((b) => lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon)) {
    return "admissions_us";
  }
  return "international";
}
