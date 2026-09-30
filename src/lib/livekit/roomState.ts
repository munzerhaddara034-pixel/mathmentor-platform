/**
 * Classroom room state: append-only board ops with a monotonic version, so clients can poll
 * `?since=<version>` and receive only new items (or 304). Pure — unit-tested.
 */
import type {
  WhiteboardBoardDelta,
  WhiteboardEquation,
  WhiteboardPlot,
  WhiteboardStroke,
} from "./protocol";

export const MAX_STROKES = 200;
export const MAX_EQUATIONS = 80;
export const MAX_PLOTS = 40;

export type Sequenced<T> = T & { seq: number };

export type ClassroomRoomState = {
  writers: string[];
  avAllowed: string[];
  ended: boolean;
  strokes: Array<Sequenced<WhiteboardStroke>>;
  equations: Array<Sequenced<WhiteboardEquation>>;
  plots: Array<Sequenced<WhiteboardPlot>>;
  /** Bumped on every change (board, grants, ended). */
  version: number;
  /** Version of the last board clear; deltas older than this must reload in full. */
  clearedAt: number;
  updatedAt: string;
};

export type BoardOp =
  | { kind: "stroke"; stroke: WhiteboardStroke }
  | { kind: "equation"; equation: WhiteboardEquation }
  | { kind: "plot"; plot: WhiteboardPlot }
  | { kind: "clear" };

export function emptyRoom(now = new Date().toISOString()): ClassroomRoomState {
  return { writers: [], avAllowed: [], ended: false, strokes: [], equations: [], plots: [], version: 0, clearedAt: 0, updatedAt: now };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sequencedList<T extends { id: string }>(value: unknown, startSeq: number): Array<Sequenced<T>> {
  if (!Array.isArray(value)) return [];
  let seq = startSeq;
  return value
    .filter((item): item is T & { seq?: unknown } => typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string")
    .map((item) => {
      seq += 1;
      return { ...item, seq: typeof item.seq === "number" ? item.seq : seq };
    });
}

/** Accepts current and legacy (pre-version) stored shapes. */
export function normalizeRoom(raw: unknown, now = new Date().toISOString()): ClassroomRoomState {
  if (typeof raw !== "object" || raw === null) return emptyRoom(now);
  const record = raw as Record<string, unknown>;
  const strokes = sequencedList<WhiteboardStroke>(record.strokes, 0);
  const equations = sequencedList<WhiteboardEquation>(record.equations, strokes.length);
  const plots = sequencedList<WhiteboardPlot>(record.plots, strokes.length + equations.length);
  const maxSeq = Math.max(0, ...strokes.map((s) => s.seq), ...equations.map((e) => e.seq), ...plots.map((p) => p.seq));
  const version = typeof record.version === "number" ? Math.max(record.version, maxSeq) : maxSeq;
  return {
    writers: stringList(record.writers),
    avAllowed: stringList(record.avAllowed),
    ended: record.ended === true,
    strokes,
    equations,
    plots,
    version,
    clearedAt: typeof record.clearedAt === "number" ? record.clearedAt : 0,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now,
  };
}

function bump(state: ClassroomRoomState, now: string): ClassroomRoomState {
  return { ...state, version: state.version + 1, updatedAt: now };
}

function appendUnique<T extends { id: string }>(list: Array<Sequenced<T>>, item: T, seq: number, cap: number) {
  if (list.some((existing) => existing.id === item.id)) return null;
  const next = [...list, { ...item, seq }];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Append-only board mutation. Duplicate ids are ignored (idempotent retries). */
export function applyBoardOp(state: ClassroomRoomState, op: BoardOp, now = new Date().toISOString()): { state: ClassroomRoomState; changed: boolean } {
  const seq = state.version + 1;
  if (op.kind === "clear") {
    const next = bump(state, now);
    return { state: { ...next, strokes: [], equations: [], plots: [], clearedAt: next.version }, changed: true };
  }
  if (op.kind === "stroke") {
    const strokes = appendUnique(state.strokes, op.stroke, seq, MAX_STROKES);
    return strokes ? { state: { ...bump(state, now), strokes }, changed: true } : { state, changed: false };
  }
  if (op.kind === "equation") {
    const equations = appendUnique(state.equations, op.equation, seq, MAX_EQUATIONS);
    return equations ? { state: { ...bump(state, now), equations }, changed: true } : { state, changed: false };
  }
  const plots = appendUnique(state.plots, op.plot, seq, MAX_PLOTS);
  return plots ? { state: { ...bump(state, now), plots }, changed: true } : { state, changed: false };
}

function toggle(list: string[], identity: string, allowed: boolean) {
  const next = list.filter((item) => item !== identity);
  if (allowed) next.push(identity);
  return next;
}

export function applyGrant(
  state: ClassroomRoomState,
  grant: { identity: string; canWriteBoard?: boolean; canPublishAv?: boolean },
  now = new Date().toISOString(),
): ClassroomRoomState {
  const writers = typeof grant.canWriteBoard === "boolean" ? toggle(state.writers, grant.identity, grant.canWriteBoard) : state.writers;
  const avAllowed = typeof grant.canPublishAv === "boolean" ? toggle(state.avAllowed, grant.identity, grant.canPublishAv) : state.avAllowed;
  return { ...bump(state, now), writers, avAllowed };
}

export function endClass(state: ClassroomRoomState, now = new Date().toISOString()): ClassroomRoomState {
  return { ...bump(state, now), ended: true, avAllowed: [] };
}

/** Teacher (re)joining or starting again reopens an ended room. */
export function reopenForTeacher(state: ClassroomRoomState, now = new Date().toISOString()): { state: ClassroomRoomState; reopened: boolean } {
  if (!state.ended) return { state, reopened: false };
  return { state: { ...bump(state, now), ended: false }, reopened: true };
}

function strip<T>(items: Array<Sequenced<T>>): T[] {
  return items.map((item) => {
    const copy: Sequenced<T> = { ...item };
    delete (copy as { seq?: number }).seq;
    return copy as T;
  });
}

/**
 * What a poller needs: `null` when unchanged (→ 304), a delta when `since` is recent,
 * otherwise the full board.
 */
export function boardDelta(state: ClassroomRoomState, since: number | null): WhiteboardBoardDelta | null {
  if (since !== null && since === state.version) return null;
  const full = since === null || since < state.clearedAt || since > state.version;
  const after = full ? -1 : since;
  return {
    full,
    version: state.version,
    strokes: strip(state.strokes.filter((item) => item.seq > after)),
    equations: strip(state.equations.filter((item) => item.seq > after)),
    plots: strip(state.plots.filter((item) => item.seq > after)),
    writers: state.writers,
    avAllowed: state.avAllowed,
    ended: state.ended,
    updatedAt: state.updatedAt,
  };
}

export function roomEtag(state: Pick<ClassroomRoomState, "version">) {
  return `W/"mm-board-${state.version}"`;
}

export function parseSince(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function sinceFromEtag(header: string | null): number | null {
  const match = header?.match(/mm-board-(\d+)/);
  return match ? Number(match[1]) : null;
}
