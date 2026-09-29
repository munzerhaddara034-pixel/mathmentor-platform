"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import type {
  ClassroomChatLine,
  ClassroomDataMessage,
  ClassroomTokenPayload,
  WhiteboardBoardState,
  WhiteboardEquation,
  WhiteboardPlot,
  WhiteboardStroke,
} from "@/lib/livekit/protocol";
import { boardFromState, mergeBoardSnapshot, type BoardSnapshot } from "@/lib/livekit/boardMerge";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { mediaPermissionCopy } from "@/lib/media/permissionCopy";
import { ClassroomStage, type ClassroomStageState, type RosterEntry } from "./ClassroomStage";
import { ClassroomTokenSkeleton } from "./ClassroomTokenSkeleton";
import { DemoLocalAvPreview } from "./DemoLocalAvPreview";
import { MediaPermissionBanner } from "./MediaPermissionBanner";

const LiveKitClassroom = dynamic(
  () => import("./LiveConnectedRoom").then((mod) => mod.LiveKitClassroom),
  { ssr: false },
);

type ClassroomUser = { id: string; name: string; role: string };

type Props = {
  roomId: string;
  user: ClassroomUser;
  staff: boolean;
};

type TokenApiResponse = ClassroomTokenPayload & {
  error?: string;
  errorAr?: string;
};

type BoardApiResponse = {
  state?: WhiteboardBoardState & { updatedAt?: string };
  error?: string;
  errorAr?: string;
};

function emptySession(roomId: string, user: ClassroomUser, staff: boolean): ClassroomTokenPayload {
  return {
    ok: false,
    demo: true,
    token: null,
    serverUrl: null,
    roomName: roomId,
    identity: user.id,
    name: user.name,
    isTeacher: staff,
    canWriteBoard: staff,
    canPublishAv: staff,
    grants: {
      room: roomId,
      roomJoin: true,
      roomCreate: staff,
      roomAdmin: staff,
      canPublish: staff,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    },
  };
}

export function LiveClassroomComponent({ roomId, user, staff }: Props) {
  const [session, setSession] = useState<ClassroomTokenPayload>(() => emptySession(roomId, user, staff));
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<{ error?: string; errorAr?: string }>({});
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [equations, setEquations] = useState<WhiteboardEquation[]>([]);
  const [plots, setPlots] = useState<WhiteboardPlot[]>([]);
  const [writers, setWriters] = useState<string[]>(staff ? [user.id] : []);
  const [avAllowed, setAvAllowed] = useState<string[]>(staff ? [user.id] : []);
  const [hands, setHands] = useState<Record<string, string>>({});
  const [handRaised, setHandRaised] = useState(false);
  const [chatLines, setChatLines] = useState<ClassroomChatLine[]>([]);
  const [chatText, setChatText] = useState("");
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [syncHint, setSyncHint] = useState<"livekit" | "poll" | "local">("local");
  const sendRef = useRef<(message: ClassroomDataMessage) => void>(() => undefined);
  const boardUpdatedAtRef = useRef<string | undefined>(undefined);
  const strokesRef = useRef(strokes);
  const equationsRef = useRef(equations);
  const plotsRef = useRef(plots);
  const writersRef = useRef(writers);
  const avAllowedRef = useRef(avAllowed);
  const endedRef = useRef(ended);

  strokesRef.current = strokes;
  equationsRef.current = equations;
  plotsRef.current = plots;
  writersRef.current = writers;
  avAllowedRef.current = avAllowed;
  endedRef.current = ended;

  const applySnapshot = useCallback((snapshot: BoardSnapshot) => {
    setStrokes(snapshot.strokes);
    setEquations(snapshot.equations);
    setPlots(snapshot.plots);
    setWriters(snapshot.writers);
    setAvAllowed(snapshot.avAllowed);
    setEnded(snapshot.ended);
    if (snapshot.updatedAt) boardUpdatedAtRef.current = snapshot.updatedAt;
  }, []);

  const persistBoard = useCallback(
    (nextStrokes: WhiteboardStroke[], nextEquations: WhiteboardEquation[], nextPlots: WhiteboardPlot[]) => {
      void fetch("/api/livekit/whiteboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          room: roomId,
          strokes: nextStrokes,
          equations: nextEquations,
          plots: nextPlots,
        }),
      }).then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as BoardApiResponse;
        if (payload.state?.updatedAt) boardUpdatedAtRef.current = payload.state.updatedAt;
      });
    },
    [roomId],
  );

  const pullBoard = useCallback(async () => {
    const boardRes = await fetch(`/api/livekit/whiteboard?room=${encodeURIComponent(roomId)}`, {
      credentials: "same-origin",
    });
    if (!boardRes.ok) return;
    const board = (await boardRes.json()) as BoardApiResponse;
    if (!board.state) return;
    const remote = boardFromState(board.state, board.state.updatedAt);
    const local: BoardSnapshot = {
      strokes: strokesRef.current,
      equations: equationsRef.current,
      plots: plotsRef.current,
      writers: writersRef.current,
      avAllowed: avAllowedRef.current,
      ended: endedRef.current,
      updatedAt: boardUpdatedAtRef.current,
    };
    if (remote.updatedAt && remote.updatedAt === local.updatedAt) return;
    applySnapshot(mergeBoardSnapshot(local, remote));
  }, [applySnapshot, roomId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setFetchError({});
      try {
        const tokenRes = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            identity: user.name,
            isTeacher: staff,
            room: roomId,
            sessionId: roomId,
          }),
        });
        const payload = (await tokenRes.json()) as TokenApiResponse;
        if (!cancelled && payload.roomName) {
          setSession({
            ...emptySession(roomId, user, staff),
            ...payload,
            grants: payload.grants ?? emptySession(roomId, user, staff).grants,
          });
          if (payload.error || payload.errorAr) {
            setFetchError({ error: payload.error, errorAr: payload.errorAr });
          }
        } else if (!cancelled) {
          setSession({
            ...emptySession(roomId, user, staff),
            error: payload.error,
            errorAr: payload.errorAr,
          });
          setFetchError({
            error: payload.error ?? "Could not issue a LiveKit token.",
            errorAr: payload.errorAr ?? "تعذّر إصدار رمز LiveKit.",
          });
        }
        const boardRes = await fetch(`/api/livekit/whiteboard?room=${encodeURIComponent(roomId)}`, {
          credentials: "same-origin",
        });
        if (boardRes.ok) {
          const board = (await boardRes.json()) as BoardApiResponse;
          if (!cancelled && board.state) {
            applySnapshot(boardFromState(board.state, board.state.updatedAt));
          }
        }
      } catch {
        if (!cancelled) {
          const error = "Could not reach the LiveKit token service.";
          const errorAr = "تعذّر الوصول إلى خدمة الرموز.";
          setSession({
            ...emptySession(roomId, user, staff),
            error,
            errorAr,
          });
          setFetchError({ error, errorAr });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, roomId, staff, user]);

  const live = Boolean(session.ok && session.token && session.serverUrl && !session.demo);

  useEffect(() => {
    if (loading) return;
    setSyncHint(live ? "livekit" : "poll");
    const intervalMs = live ? 8000 : 1500;
    const timer = window.setInterval(() => {
      void pullBoard();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [live, loading, pullBoard]);

  const applyRemote = useCallback(
    (message: ClassroomDataMessage) => {
      if (message.kind === "whiteboard.stroke") {
        setStrokes((current) =>
          current.some((item) => item.id === message.stroke.id) ? current : [...current, message.stroke],
        );
      } else if (message.kind === "whiteboard.equation") {
        setEquations((current) =>
          current.some((item) => item.id === message.equation.id) ? current : [...current, message.equation],
        );
      } else if (message.kind === "whiteboard.plot") {
        setPlots((current) =>
          current.some((item) => item.id === message.plot.id) ? current : [...current, message.plot],
        );
      } else if (message.kind === "whiteboard.clear") {
        setStrokes([]);
        setEquations([]);
        setPlots([]);
      } else if (message.kind === "whiteboard.grant") {
        setWriters((current) => {
          const next = current.filter((id) => id !== message.identity);
          if (message.allowed) next.push(message.identity);
          return next;
        });
      } else if (message.kind === "av.grant") {
        setAvAllowed((current) => {
          const next = current.filter((id) => id !== message.identity);
          if (message.allowed) next.push(message.identity);
          return next;
        });
      } else if (message.kind === "hand") {
        setHands((current) => {
          const next = { ...current };
          if (message.raised) next[message.identity] = message.name || message.identity;
          else delete next[message.identity];
          return next;
        });
        if (message.identity === user.id) setHandRaised(message.raised);
      } else if (message.kind === "chat") {
        setChatLines((current) => [...current, message.line]);
      } else if (message.kind === "class.end") {
        setEnded(true);
      }
    },
    [user.id],
  );

  const broadcast = useCallback(
    (message: ClassroomDataMessage) => {
      sendRef.current(message);
      applyRemote(message);
    },
    [applyRemote],
  );

  const canWrite = session.isTeacher || writers.includes(user.id) || session.canWriteBoard;

  const onStroke = useCallback(
    (stroke: WhiteboardStroke) => {
      setStrokes((current) => {
        const next = [...current, stroke];
        persistBoard(next, equationsRef.current, plotsRef.current);
        return next;
      });
      sendRef.current({ kind: "whiteboard.stroke", stroke });
    },
    [persistBoard],
  );

  const onEquation = useCallback(
    (equation: WhiteboardEquation) => {
      setEquations((current) => {
        const next = [...current, equation];
        persistBoard(strokesRef.current, next, plotsRef.current);
        return next;
      });
      sendRef.current({ kind: "whiteboard.equation", equation });
    },
    [persistBoard],
  );

  const onPlot = useCallback(
    (plot: WhiteboardPlot) => {
      setPlots((current) => {
        const next = [...current, plot];
        persistBoard(strokesRef.current, equationsRef.current, next);
        return next;
      });
      sendRef.current({ kind: "whiteboard.plot", plot });
    },
    [persistBoard],
  );

  const onClear = useCallback(() => {
    setStrokes([]);
    setEquations([]);
    setPlots([]);
    persistBoard([], [], []);
    sendRef.current({ kind: "whiteboard.clear" });
  }, [persistBoard]);

  const grant = useCallback(
    async (identity: string, patch: { canWriteBoard?: boolean; canPublishAv?: boolean }) => {
      await fetch("/api/livekit/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ room: roomId, identity, ...patch }),
      });
      if (typeof patch.canWriteBoard === "boolean") {
        broadcast({ kind: "whiteboard.grant", identity, allowed: patch.canWriteBoard });
      }
      if (typeof patch.canPublishAv === "boolean") {
        broadcast({ kind: "av.grant", identity, allowed: patch.canPublishAv });
      }
    },
    [broadcast, roomId],
  );

  const onEndClass = useCallback(async () => {
    await fetch("/api/livekit/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ room: roomId }),
    });
    broadcast({ kind: "class.end" });
  }, [broadcast, roomId]);

  const stage: ClassroomStageState = {
    strokes,
    equations,
    plots,
    onStroke,
    onEquation,
    onPlot,
    onClear,
    canWrite,
    hands,
    handRaised,
    onRaiseHand: () => {
      const next = !handRaised;
      setHandRaised(next);
      broadcast({ kind: "hand", identity: user.id, raised: next, name: user.name });
    },
    chatLines,
    chatText,
    onChatText: setChatText,
    onSendChat: () => {
      const text = chatText.trim();
      if (!text) return;
      const line: ClassroomChatLine = {
        id: `ch-${Date.now().toString(36)}`,
        identity: user.id,
        name: user.name,
        text,
        at: new Date().toISOString(),
      };
      setChatText("");
      broadcast({ kind: "chat", line });
    },
    writers,
    avAllowed,
    onGrantWrite: (identity, allowed) => void grant(identity, { canWriteBoard: allowed }),
    onGrantAv: (identity, allowed) => void grant(identity, { canPublishAv: allowed }),
    onEndClass: () => void onEndClass(),
    ended,
    muted,
    cameraOff,
    onToggleMute: () => setMuted((value) => !value),
    onToggleCamera: () => setCameraOff((value) => !value),
  };

  const demoRoster: RosterEntry[] = useMemo(() => {
    if (staff) {
      return [{ identity: user.id, name: user.name, isLocal: true }];
    }
    return [
      { identity: "teacher-host", name: INSTRUCTOR_EN },
      { identity: user.id, name: user.name, isLocal: true },
    ];
  }, [staff, user.id, user.name]);

  if (loading) {
    return <ClassroomTokenSkeleton />;
  }

  const demoAvAllowed = Boolean(session.isTeacher || session.canPublishAv);

  return (
    <main className="live-classroom-page mm-mobile-stack">
      <ApiErrorBanner error={fetchError.error} errorAr={fetchError.errorAr} className="live-token-error" />
      <p className="muted live-sync-hint" role="status">
        {syncHint === "livekit"
          ? "مزامنة السبورة عبر LiveKit data · Whiteboard sync: LiveKit data channel"
          : "مزامنة السبورة عبر HTTP (وضع تجريبي بدون LiveKit) · Whiteboard sync: HTTP poll"}
        {" · "}
        <a href="/docs/LIVE_SYNC.md">docs/LIVE_SYNC.md</a>
      </p>
      {!live ? (
        <MediaPermissionBanner
          tone="info"
          error={
            demoAvAllowed
              ? "Demo / shell mode: no LiveKit Cloud connection. Local camera/mic preview only (not broadcast)."
              : "Demo / shell mode: camera & microphone are not connected to LiveKit. Ask the teacher or configure LIVEKIT_* env."
          }
          errorAr={
            demoAvAllowed
              ? "وضع تجريبي: لا اتصال LiveKit Cloud. معاينة محلية للكاميرا/الميكروفون فقط (بدون بث)."
              : "وضع تجريبي: الكاميرا والميكروفون غير متصلين بـ LiveKit. اطلب من الأستاذ أو اضبط مفاتيح LIVEKIT_*."
          }
          hint={mediaPermissionCopy("both").hint}
          hintAr={mediaPermissionCopy("both").hintAr}
        />
      ) : null}
      {live ? (
        <LiveKitClassroom
          session={session}
          userId={user.id}
          onRemote={applyRemote}
          onSend={(send) => {
            sendRef.current = send;
          }}
          stage={stage}
        />
      ) : (
        <ClassroomStage
          session={session}
          userId={user.id}
          stage={stage}
          roster={demoRoster}
          video={
            demoAvAllowed ? (
              <DemoLocalAvPreview enabled muted={muted} cameraOff={cameraOff} />
            ) : undefined
          }
        />
      )}
    </main>
  );
}
