import type {
  WhiteboardBoardState,
  WhiteboardEquation,
  WhiteboardPlot,
  WhiteboardStroke,
} from "./protocol";

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return map;
}

export function mergeBoardLists<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = byId(local);
  for (const item of remote) map.set(item.id, item);
  return Array.from(map.values());
}

export type BoardSnapshot = {
  strokes: WhiteboardStroke[];
  equations: WhiteboardEquation[];
  plots: WhiteboardPlot[];
  writers: string[];
  avAllowed: string[];
  ended: boolean;
  updatedAt?: string;
};

export function boardFromState(state: WhiteboardBoardState | undefined, updatedAt?: string): BoardSnapshot {
  return {
    strokes: state?.strokes ?? [],
    equations: state?.equations ?? [],
    plots: state?.plots ?? [],
    writers: state?.writers ?? [],
    avAllowed: state?.avAllowed ?? [],
    ended: Boolean(state?.ended),
    updatedAt: updatedAt ?? state?.updatedAt,
  };
}

/**
 * Prefer remote lists when remote.updatedAt is newer (handles clear + late join).
 * Otherwise union by id so optimistic local strokes are not dropped mid-PUT.
 */
export function mergeBoardSnapshot(local: BoardSnapshot, remote: BoardSnapshot): BoardSnapshot {
  const remoteNewer =
    Boolean(remote.updatedAt) &&
    (!local.updatedAt || Date.parse(remote.updatedAt ?? "") >= Date.parse(local.updatedAt ?? ""));

  if (remoteNewer) {
    return {
      strokes: remote.strokes,
      equations: remote.equations,
      plots: remote.plots,
      writers: remote.writers,
      avAllowed: remote.avAllowed,
      ended: remote.ended || local.ended,
      updatedAt: remote.updatedAt,
    };
  }

  return {
    strokes: mergeBoardLists(local.strokes, remote.strokes),
    equations: mergeBoardLists(local.equations, remote.equations),
    plots: mergeBoardLists(local.plots, remote.plots),
    writers: Array.from(new Set([...local.writers, ...remote.writers])),
    avAllowed: Array.from(new Set([...local.avAllowed, ...remote.avAllowed])),
    ended: local.ended || remote.ended,
    updatedAt: local.updatedAt,
  };
}
