/** Client-side board snapshot + delta application (pure). */
import type { WhiteboardBoardDelta, WhiteboardEquation, WhiteboardPlot, WhiteboardStroke } from "./protocol";

export const CLIENT_MAX_STROKES = 200;

export type BoardSnapshot = {
  strokes: WhiteboardStroke[];
  equations: WhiteboardEquation[];
  plots: WhiteboardPlot[];
  writers: string[];
  avAllowed: string[];
  ended: boolean;
  version: number;
};

export function emptyBoard(): BoardSnapshot {
  return { strokes: [], equations: [], plots: [], writers: [], avAllowed: [], ended: false, version: 0 };
}

/** Append items whose id is not present yet (keeps order, caps length). */
export function appendById<T extends { id: string }>(current: T[], incoming: T[], cap = Number.POSITIVE_INFINITY): T[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map((item) => item.id));
  const added = incoming.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  if (!added.length) return current;
  const next = [...current, ...added];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/**
 * Full deltas replace the board (clear / late join); partial deltas append. Local optimistic
 * items not yet on the server survive a partial delta because nothing is removed.
 */
export function applyBoardDelta(local: BoardSnapshot, delta: WhiteboardBoardDelta): BoardSnapshot {
  if (delta.full) {
    return {
      strokes: delta.strokes.slice(-CLIENT_MAX_STROKES),
      equations: delta.equations,
      plots: delta.plots,
      writers: delta.writers,
      avAllowed: delta.avAllowed,
      ended: delta.ended,
      version: delta.version,
    };
  }
  return {
    strokes: appendById(local.strokes, delta.strokes, CLIENT_MAX_STROKES),
    equations: appendById(local.equations, delta.equations),
    plots: appendById(local.plots, delta.plots),
    writers: delta.writers,
    avAllowed: delta.avAllowed,
    ended: delta.ended,
    version: Math.max(local.version, delta.version),
  };
}
