/**
 * Whiteboard stroke compaction + LiveKit data-channel chunking.
 * Dependency-free (type-only imports) so `node --test` can load it directly.
 *
 * - Points are normalised 0..1 board coordinates; 3 decimals ≈ 1px on a 1000px board.
 * - Ramer–Douglas–Peucker thinning removes points that do not change the drawn shape.
 * - LiveKit reliable data packets are limited to ~15 KiB, so long strokes are split into
 *   self-describing chunks (each under STROKE_CHUNK_MAX_BYTES) and reassembled by id.
 */
import type { WhiteboardPoint, WhiteboardStroke } from "./protocol";

/** LiveKit reliable packet limit is 15 KiB user payload; keep headroom for headers/topic. */
export const STROKE_CHUNK_MAX_BYTES = 14_000;
/** Hard cap after thinning (a stroke longer than this is truncated, not rejected). */
export const STROKE_MAX_POINTS = 2_000;
/** RDP tolerance in board units (~1.5px on a 1000px wide board). */
export const STROKE_SIMPLIFY_EPSILON = 0.0015;
/** Skip pointer samples closer than this to the previous kept sample while drawing. */
export const STROKE_MIN_SAMPLE_DISTANCE = 0.002;

const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const ID_RE = /^[a-zA-Z0-9_.:-]{1,80}$/;

export function roundCoord(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * factor) / factor;
}

export function roundPoint(point: WhiteboardPoint, decimals = 3): WhiteboardPoint {
  return { x: roundCoord(point.x, decimals), y: roundCoord(point.y, decimals) };
}

function distance(a: WhiteboardPoint, b: WhiteboardPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Perpendicular distance from p to the segment a–b. */
function segmentDistance(p: WhiteboardPoint, a: WhiteboardPoint, b: WhiteboardPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Iterative Ramer–Douglas–Peucker (no recursion depth issues on long strokes). */
export function simplifyPoints(points: WhiteboardPoint[], epsilon = STROKE_SIMPLIFY_EPSILON): WhiteboardPoint[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop() as [number, number];
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = segmentDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > epsilon) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Round to 3 decimals, drop consecutive duplicates, thin with RDP, cap length. */
export function compactPoints(points: WhiteboardPoint[], epsilon = STROKE_SIMPLIFY_EPSILON): WhiteboardPoint[] {
  const rounded: WhiteboardPoint[] = [];
  for (const point of points) {
    const next = roundPoint(point);
    const last = rounded[rounded.length - 1];
    if (!last || last.x !== next.x || last.y !== next.y) rounded.push(next);
  }
  const thinned = simplifyPoints(rounded, epsilon);
  return thinned.length > STROKE_MAX_POINTS ? thinned.slice(0, STROKE_MAX_POINTS) : thinned;
}

export function compactStroke(stroke: WhiteboardStroke): WhiteboardStroke {
  return { ...stroke, width: Math.round(stroke.width * 10) / 10, points: compactPoints(stroke.points) };
}

/** True when the new pointer sample is far enough from the last kept one to record. */
export function shouldSample(last: WhiteboardPoint | undefined, next: WhiteboardPoint): boolean {
  return !last || distance(last, next) >= STROKE_MIN_SAMPLE_DISTANCE;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate an untrusted stroke from the network; returns a compacted copy or null. */
export function sanitizeStroke(raw: unknown, authorId: string): WhiteboardStroke | null {
  if (!isRecord(raw)) return null;
  const { id, color, width, points } = raw;
  if (typeof id !== "string" || !ID_RE.test(id)) return null;
  if (typeof color !== "string" || !COLOR_RE.test(color)) return null;
  if (!isFiniteNumber(width) || width <= 0 || width > 40) return null;
  if (!Array.isArray(points) || points.length < 2 || points.length > STROKE_MAX_POINTS * 4) return null;
  const clean: WhiteboardPoint[] = [];
  for (const point of points) {
    if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null;
    clean.push({ x: point.x, y: point.y });
  }
  const compacted = compactStroke({ id, color, width, points: clean, authorId });
  return compacted.points.length >= 2 ? compacted : null;
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export type StrokeChunkMessage = {
  kind: "whiteboard.stroke.chunk";
  id: string;
  color: string;
  width: number;
  authorId: string;
  index: number;
  total: number;
  points: WhiteboardPoint[];
};

function chunkBytes(message: StrokeChunkMessage): number {
  return utf8Bytes(JSON.stringify(message));
}

/**
 * Split a stroke into data-channel messages that each serialise under `maxBytes`.
 * Short strokes produce a single chunk. Chunk boundaries do not overlap; reassembly
 * concatenates points in index order.
 */
export function chunkStroke(stroke: WhiteboardStroke, maxBytes = STROKE_CHUNK_MAX_BYTES): StrokeChunkMessage[] {
  const base = { kind: "whiteboard.stroke.chunk" as const, id: stroke.id, color: stroke.color, width: stroke.width, authorId: stroke.authorId };
  const groups: WhiteboardPoint[][] = [];
  let current: WhiteboardPoint[] = [];
  // Byte size grows linearly with points, so measure the prefix incrementally.
  let currentBytes = chunkBytes({ ...base, index: 99_999, total: 99_999, points: [] });
  for (const point of stroke.points) {
    const pointBytes = utf8Bytes(JSON.stringify(point)) + 1;
    if (current.length > 0 && currentBytes + pointBytes > maxBytes) {
      groups.push(current);
      current = [];
      currentBytes = chunkBytes({ ...base, index: 99_999, total: 99_999, points: [] });
    }
    current.push(point);
    currentBytes += pointBytes;
  }
  if (current.length || groups.length === 0) groups.push(current);
  return groups.map((points, index) => ({ ...base, index, total: groups.length, points }));
}

/** Collects chunks per stroke id; returns the full stroke once every part arrived. */
export class StrokeAssembler {
  private readonly pending = new Map<string, { parts: Array<WhiteboardPoint[] | undefined>; received: number; at: number }>();

  private readonly maxPending: number;
  private readonly ttlMs: number;

  constructor(maxPending = 64, ttlMs = 60_000) {
    this.maxPending = maxPending;
    this.ttlMs = ttlMs;
  }

  add(chunk: StrokeChunkMessage, now = Date.now()): WhiteboardStroke | null {
    if (chunk.total < 1 || chunk.index < 0 || chunk.index >= chunk.total || chunk.total > 64) return null;
    this.prune(now);
    const key = `${chunk.authorId}:${chunk.id}`;
    const entry = this.pending.get(key) ?? { parts: new Array<WhiteboardPoint[] | undefined>(chunk.total), received: 0, at: now };
    if (entry.parts.length !== chunk.total) return null;
    if (!entry.parts[chunk.index]) {
      entry.parts[chunk.index] = chunk.points;
      entry.received += 1;
    }
    if (entry.received < chunk.total) {
      this.pending.set(key, entry);
      return null;
    }
    this.pending.delete(key);
    const points = entry.parts.flatMap((part) => part ?? []);
    return { id: chunk.id, color: chunk.color, width: chunk.width, authorId: chunk.authorId, points };
  }

  get size(): number {
    return this.pending.size;
  }

  private prune(now: number) {
    for (const [key, entry] of this.pending) {
      if (now - entry.at > this.ttlMs) this.pending.delete(key);
    }
    while (this.pending.size > this.maxPending) {
      const oldest = this.pending.keys().next().value;
      if (oldest === undefined) break;
      this.pending.delete(oldest);
    }
  }
}
