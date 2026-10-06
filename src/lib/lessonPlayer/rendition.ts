/**
 * Rendition choice for the silent master video: smallest rendition that covers the player's on-screen pixels,
 * capped by the network (Save-Data / 2g / 3g / low downlink). Pure so it is unit-tested; the client passes
 * `window.innerWidth`, `devicePixelRatio` and `navigator.connection`.
 */
import { RENDITIONS, type Rendition } from "./manifest";

export type ConnectionHint = {
  saveData?: boolean;
  effectiveType?: string;
  /** Mbit/s estimate from the Network Information API. */
  downlink?: number;
};

export type RenditionInput = {
  /** CSS pixels the player occupies (or the viewport width). */
  width: number;
  devicePixelRatio?: number;
  connection?: ConnectionHint | null;
  /** Renditions present in the manifest. */
  available: readonly Rendition[];
};

const HEIGHT: Record<Rendition, number> = { "1080": 1080, "720": 720, "480": 480 };
/** 16:9 frame width for each rendition. */
const FRAME_WIDTH: Record<Rendition, number> = { "1080": 1920, "720": 1280, "480": 854 };

/** Highest rendition the network allows (null = no cap). */
export function networkCap(connection?: ConnectionHint | null): Rendition | null {
  if (!connection) return null;
  if (connection.saveData === true) return "480";
  const type = (connection.effectiveType ?? "").toLowerCase();
  if (type === "slow-2g" || type === "2g" || type === "3g") return "480";
  if (typeof connection.downlink === "number" && connection.downlink > 0) {
    if (connection.downlink < 1.5) return "480";
    if (connection.downlink < 5) return "720";
  }
  return null;
}

/** Rendition whose frame width covers `pixels` (device pixels). */
export function renditionForPixels(pixels: number): Rendition {
  if (pixels <= FRAME_WIDTH["480"]) return "480";
  if (pixels <= FRAME_WIDTH["720"]) return "720";
  return "1080";
}

export function pickRendition(input: RenditionInput): Rendition | null {
  const available = RENDITIONS.filter((key) => input.available.includes(key));
  if (!available.length) return null;
  // Cap DPR at 2: a 3x phone does not need 1080p for a lesson board.
  const dpr = Math.min(Math.max(input.devicePixelRatio ?? 1, 1), 2);
  const width = Number.isFinite(input.width) && input.width > 0 ? input.width : 1280;
  let target = HEIGHT[renditionForPixels(width * dpr)];
  const cap = networkCap(input.connection);
  if (cap) target = Math.min(target, HEIGHT[cap]);
  // Best available at or below the target; otherwise the smallest one above it.
  const ascending = [...available].sort((a, b) => HEIGHT[a] - HEIGHT[b]);
  const atOrBelow = ascending.filter((key) => HEIGHT[key] <= target);
  return atOrBelow.length ? atOrBelow[atOrBelow.length - 1] : ascending[0];
}
