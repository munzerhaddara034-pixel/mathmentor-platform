"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import type {
  ClassroomChatLine,
  ClassroomDataMessage,
  ClassroomTokenPayload,
  WhiteboardEquation,
  WhiteboardStroke,
} from "@/lib/livekit/protocol";
import { ClassroomStage, type ClassroomStageState, type RosterEntry } from "./ClassroomStage";

const LiveKitClassroom = dynamic(
  () => import("./LiveConnectedRoom").then((mod) => mod.LiveKitClassroom),
  { ssr: false },
);

type Props = {
  roomId: string;
  user: { id: string; name: string; role: string };
  staff: boolean;
};

const emptySession = (roomId: string, user: Props["user"], staff: boolean): ClassroomTokenPayload => ({
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
});

export function LiveClassroomComponent({ roomId, user, staff }: Props) {
  const [session, setSession] = useState<ClassroomTokenPayload>(() => emptySession(roomId, user, staff));
  const [loading, setLoading] = useState(true);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [equations, setEquations] = useState<WhiteboardEquation[]>([]);
  const [writers, setWriters] = useState<string[]>(staff ? [user.id] : []);
  const [avAllowed, setAvAllowed] = useState<string[]>(staff ? [user.id] : []);
  const [hands, setHands] = useState<Record<string, string>>({});
  const [handRaised, setHandRaised] = useState(false);
  const [chatLines, setChatLines] = useState<ClassroomChatLine[]>([]);
  const [chatText, setChatText] = useState("");
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const sendRef = useRef<(message: ClassroomDataMessage) => void>(() => undefined);

  const persistBoard = useCallback(
    (nextStrokes: WhiteboardStroke[], nextEquations: WhiteboardEquation[]) => {
      void fetch("/api/livekit/whiteboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ room: roomId, strokes: nextStrokes, equations: nextEquations }),
      });
    },
    [roomId],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
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
        const payload = (await tokenRes.json()) as ClassroomTokenPayload & { error?: string; errorAr?: string };
        if (!cancelled && payload.roomName) {
          setSession({
            ...emptySession(roomId, user, staff),
            ...payload,
            grants: payload.grants ?? emptySession(roomId, user, staff).grants,
          });
        } else if (!cancelled) {
          setSession({
            ...emptySession(roomId, user, staff),
            error: payload.error,
            errorAr: payload.errorAr,
          });
        }
        const boardRes = await fetch(`/api/livekit/whiteboard?room=${encodeURIComponent(roomId)}`, {
          credentials: "same-origin",
        });
        if (boardRes.ok) {
          const board = (await boardRes.json()) as {
            state?: { strokes?: WhiteboardStroke[]; equations?: WhiteboardEquation[]; writers?: string[]; avAllowed?: string[]; ended?: boolean };
          };
          if (!cancelled && board.state) {
            setStrokes(board.state.strokes ?? []);
            setEquations(board.state.equations ?? []);
            setWriters(board.state.writers ?? []);
            setAvAllowed(board.state.avAllowed ?? []);
            setEnded(Boolean(board.state.ended));
          }
        }
      } catch {
        if (!cancelled) {
          setSession({
            ...emptySession(roomId, user, staff),
            error: "Could not reach the LiveKit token service.",
            errorAr: "تعذّر الوصول إلى خدمة الرموز.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId, staff, user]);

  const applyRemote = useCallback((message: ClassroomDataMessage) => {
    if (message.kind === "whiteboard.stroke") {
      setStrokes((current) => (current.some((item) => item.id === message.stroke.id) ? current : [...current, message.stroke]));
    } else if (message.kind === "whiteboard.equation") {
      setEquations((current) =>
        current.some((item) => item.id === message.equation.id) ? current : [...current, message.equation],
      );
    } else if (message.kind === "whiteboard.clear") {
      setStrokes([]);
      setEquations([]);
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
  }, [user.id]);

  const broadcast = useCallback((message: ClassroomDataMessage) => {
    sendRef.current(message);
    applyRemote(message);
  }, [applyRemote]);

  const canWrite = session.isTeacher || writers.includes(user.id) || session.canWriteBoard;

  const onStroke = useCallback(
    (stroke: WhiteboardStroke) => {
      setStrokes((current) => {
        const next = [...current, stroke];
        persistBoard(next, equations);
        return next;
      });
      sendRef.current({ kind: "whiteboard.stroke", stroke });
    },
    [equations, persistBoard],
  );

  const onEquation = useCallback(
    (equation: WhiteboardEquation) => {
      setEquations((current) => {
        const next = [...current, equation];
        persistBoard(strokes, next);
        return next;
      });
      sendRef.current({ kind: "whiteboard.equation", equation });
    },
    [persistBoard, strokes],
  );

  const onClear = useCallback(() => {
    setStrokes([]);
    setEquations([]);
    persistBoard([], []);
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
    onStroke,
    onEquation,
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

  const demoRoster: RosterEntry[] = useMemo(
    () => [
      { identity: "teacher-host", name: INSTRUCTOR_EN, isLocal: staff },
      { identity: user.id, name: user.name, isLocal: true },
    ],
    [staff, user.id, user.name],
  );

  if (loading) {
    return (
      <main className="shell live-classroom-loading">
        <p className="eyebrow">صف مباشر</p>
        <h1>جارٍ تجهيز الحصة…</h1>
      </main>
    );
  }

  const live = Boolean(session.ok && session.token && session.serverUrl && !session.demo);

  return (
    <main className="live-classroom-page">
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
        <ClassroomStage session={session} userId={user.id} stage={stage} roster={demoRoster} />
      )}
    </main>
  );
}
