"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyBoardDelta, appendById, CLIENT_MAX_STROKES, emptyBoard, type BoardSnapshot } from "@/lib/livekit/boardMerge";
import type {
  ClassroomDataMessage,
  WhiteboardBoardDelta,
  WhiteboardEquation,
  WhiteboardPlot,
  WhiteboardStroke,
} from "@/lib/livekit/protocol";
import { chunkStroke, StrokeAssembler } from "@/lib/livekit/strokeCodec";

/** Demo/HTTP mode poll interval. With LiveKit the board only re-syncs on (re)connect / tab focus. */
export const DEMO_POLL_MS = 4_000;

type BoardOpBody =
  | { kind: "stroke"; stroke: WhiteboardStroke }
  | { kind: "equation"; equation: WhiteboardEquation }
  | { kind: "plot"; plot: WhiteboardPlot }
  | { kind: "clear" };

type BoardGetResponse = { ok?: boolean; delta?: WhiteboardBoardDelta; error?: string; errorAr?: string };

export type BoardError = { error?: string; errorAr?: string };

type BoardMeta = Partial<Pick<BoardSnapshot, "writers" | "avAllowed" | "ended">>;

export function useClassroomBoard(input: {
  roomId: string;
  /** LiveKit connected: no interval polling. */
  live: boolean;
  /** Start polling only after the token request settled. */
  ready: boolean;
  send: (message: ClassroomDataMessage) => void;
}) {
  const { roomId, live, ready, send } = input;
  const [board, setBoard] = useState<BoardSnapshot>(emptyBoard);
  const [boardError, setBoardError] = useState<BoardError>({});
  const [loaded, setLoaded] = useState(false);
  const versionRef = useRef<number | null>(null);
  const inFlight = useRef(false);
  const assembler = useRef(new StrokeAssembler());

  const pullBoard = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const since = versionRef.current;
      const query = new URLSearchParams({ room: roomId });
      if (since !== null) query.set("since", String(since));
      const response = await fetch(`/api/livekit/whiteboard?${query.toString()}`, { credentials: "same-origin", cache: "no-store" });
      if (response.status === 304) return;
      const payload = (await response.json()) as BoardGetResponse;
      if (!response.ok || !payload.delta) {
        setBoardError({ error: payload.error ?? "Board unavailable.", errorAr: payload.errorAr ?? "تعذّر تحميل السبورة." });
        return;
      }
      const delta = payload.delta;
      versionRef.current = delta.version;
      setBoard((current) => applyBoardDelta(current, delta));
      setBoardError({});
    } catch {
      setBoardError({ error: "Board sync failed — retrying.", errorAr: "تعذّرت مزامنة السبورة — نعيد المحاولة." });
    } finally {
      inFlight.current = false;
      setLoaded(true);
    }
  }, [roomId]);

  const postOp = useCallback(
    async (op: BoardOpBody) => {
      try {
        const response = await fetch("/api/livekit/whiteboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ room: roomId, op }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as BoardError;
          setBoardError({ error: payload.error ?? "Could not save to the board.", errorAr: payload.errorAr ?? "تعذّر الحفظ على السبورة." });
        }
      } catch {
        setBoardError({ error: "Could not save to the board.", errorAr: "تعذّر الحفظ على السبورة — تحقّق من الاتصال." });
      }
    },
    [roomId],
  );

  // Initial load + demo-mode polling (paused while the tab is hidden).
  useEffect(() => {
    if (!ready) return;
    void pullBoard();
    if (live) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void pullBoard();
    }, DEMO_POLL_MS);
    return () => window.clearInterval(timer);
  }, [live, pullBoard, ready]);

  // Coming back to the tab: one cheap `since` request (304 when nothing changed).
  useEffect(() => {
    if (!ready) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void pullBoard();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pullBoard, ready]);

  const addStroke = useCallback(
    (stroke: WhiteboardStroke) => {
      setBoard((current) => ({ ...current, strokes: appendById(current.strokes, [stroke], CLIENT_MAX_STROKES) }));
      for (const chunk of chunkStroke(stroke)) send(chunk);
      void postOp({ kind: "stroke", stroke });
    },
    [postOp, send],
  );

  const addEquation = useCallback(
    (equation: WhiteboardEquation) => {
      setBoard((current) => ({ ...current, equations: appendById(current.equations, [equation]) }));
      send({ kind: "whiteboard.equation", equation });
      void postOp({ kind: "equation", equation });
    },
    [postOp, send],
  );

  const addPlot = useCallback(
    (plot: WhiteboardPlot) => {
      setBoard((current) => ({ ...current, plots: appendById(current.plots, [plot]) }));
      send({ kind: "whiteboard.plot", plot });
      void postOp({ kind: "plot", plot });
    },
    [postOp, send],
  );

  const clearBoard = useCallback(() => {
    setBoard((current) => ({ ...current, strokes: [], equations: [], plots: [] }));
    send({ kind: "whiteboard.clear" });
    void postOp({ kind: "clear" });
  }, [postOp, send]);

  /** Board-related data-channel messages; returns true when handled. */
  const applyBoardMessage = useCallback((message: ClassroomDataMessage): boolean => {
    if (message.kind === "whiteboard.stroke.chunk") {
      const stroke = assembler.current.add(message);
      if (stroke) setBoard((current) => ({ ...current, strokes: appendById(current.strokes, [stroke], CLIENT_MAX_STROKES) }));
      return true;
    }
    if (message.kind === "whiteboard.stroke") {
      setBoard((current) => ({ ...current, strokes: appendById(current.strokes, [message.stroke], CLIENT_MAX_STROKES) }));
      return true;
    }
    if (message.kind === "whiteboard.equation") {
      setBoard((current) => ({ ...current, equations: appendById(current.equations, [message.equation]) }));
      return true;
    }
    if (message.kind === "whiteboard.plot") {
      setBoard((current) => ({ ...current, plots: appendById(current.plots, [message.plot]) }));
      return true;
    }
    if (message.kind === "whiteboard.clear") {
      setBoard((current) => ({ ...current, strokes: [], equations: [], plots: [] }));
      return true;
    }
    return false;
  }, []);

  const patchBoard = useCallback((patch: BoardMeta | ((current: BoardSnapshot) => BoardMeta)) => {
    setBoard((current) => ({ ...current, ...(typeof patch === "function" ? patch(current) : patch) }));
  }, []);

  return { board, boardError, loaded, pullBoard, addStroke, addEquation, addPlot, clearBoard, applyBoardMessage, patchBoard };
}
