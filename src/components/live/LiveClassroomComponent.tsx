"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ClassroomChatLine, ClassroomDataMessage } from "@/lib/livekit/protocol";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { mediaPermissionCopy } from "@/lib/media/permissionCopy";
import { ClassroomStage, type ClassroomStageState, type RosterEntry } from "./ClassroomStage";
import { ClassroomTokenSkeleton } from "./ClassroomTokenSkeleton";
import { DemoLocalAvPreview } from "./DemoLocalAvPreview";
import { MediaPermissionBanner } from "./MediaPermissionBanner";
import { useClassroomBoard } from "./useClassroomBoard";
import { useClassroomToken, type ClassroomUser } from "./useClassroomToken";
import { useNs } from "@/components/i18n/useNs";
import { liveMessages } from "@/lib/i18n/ns/live";

const LiveKitClassroom = dynamic(
  () => import("./LiveConnectedRoom").then((mod) => mod.LiveKitClassroom),
  { ssr: false },
);

type Props = {
  roomId: string;
  user: ClassroomUser;
  staff: boolean;
};

type ActionError = { error?: string; errorAr?: string };

function toggleList(list: string[], identity: string, allowed: boolean) {
  const next = list.filter((id) => id !== identity);
  if (allowed) next.push(identity);
  return next;
}

function AccessDenied({ error, errorAr }: ActionError) {
  const t = useNs(liveMessages).room;
  return (
    <main className="shell live-classroom-page mm-mobile-stack">
      <ApiErrorBanner error={error} errorAr={errorAr} className="live-token-error" />
      <p>
        <Link className="btn dark" href="/live">
          {t.backToBooking}
        </Link>
      </p>
    </main>
  );
}

export function LiveClassroomComponent({ roomId, user, staff }: Props) {
  const t = useNs(liveMessages).room;
  const { session, loading, allowed, live, reload } = useClassroomToken(roomId, user, staff);
  const sendRef = useRef<(message: ClassroomDataMessage) => void>(() => undefined);
  const send = useCallback((message: ClassroomDataMessage) => sendRef.current(message), []);
  const boardApi = useClassroomBoard({ roomId, live, ready: !loading && allowed, send });
  const { board, patchBoard, applyBoardMessage } = boardApi;

  const [hands, setHands] = useState<Record<string, string>>({});
  const [handRaised, setHandRaised] = useState(false);
  const [chatLines, setChatLines] = useState<ClassroomChatLine[]>([]);
  const [chatText, setChatText] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(true);
  const [actionError, setActionError] = useState<ActionError>({});

  const applyRemote = useCallback(
    (message: ClassroomDataMessage) => {
      if (applyBoardMessage(message)) return;
      if (message.kind === "whiteboard.grant") {
        patchBoard((current) => ({ writers: toggleList(current.writers, message.identity, message.allowed) }));
      } else if (message.kind === "av.grant") {
        patchBoard((current) => ({ avAllowed: toggleList(current.avAllowed, message.identity, message.allowed) }));
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
        patchBoard({ ended: true });
      }
    },
    [applyBoardMessage, patchBoard, user.id],
  );

  const broadcast = useCallback(
    (message: ClassroomDataMessage) => {
      send(message);
      applyRemote(message);
    },
    [applyRemote, send],
  );

  const grant = useCallback(
    async (identity: string, patch: { canWriteBoard?: boolean; canPublishAv?: boolean }) => {
      try {
        const response = await fetch("/api/livekit/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ room: roomId, identity, ...patch }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as ActionError;
          setActionError({ error: payload.error ?? t.permissionFailed, errorAr: payload.errorAr ?? t.permissionFailed });
          return;
        }
        setActionError({});
        if (typeof patch.canWriteBoard === "boolean") broadcast({ kind: "whiteboard.grant", identity, allowed: patch.canWriteBoard });
        if (typeof patch.canPublishAv === "boolean") broadcast({ kind: "av.grant", identity, allowed: patch.canPublishAv });
      } catch {
        setActionError({ error: t.permissionFailed, errorAr: t.permissionFailed });
      }
    },
    [broadcast, roomId, t],
  );

  const endClass = useCallback(async () => {
    try {
      const response = await fetch("/api/livekit/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ room: roomId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ActionError;
        setActionError({ error: payload.error ?? t.endFailed, errorAr: payload.errorAr ?? t.endFailed });
        return;
      }
      broadcast({ kind: "class.end" });
    } catch {
      setActionError({ error: t.endFailed, errorAr: t.endFailed });
    }
  }, [broadcast, roomId, t]);

  /** Teacher "Start again": a fresh token request reopens the room server-side. */
  const restartClass = useCallback(async () => {
    await reload();
    await boardApi.pullBoard();
  }, [boardApi, reload]);

  const canWrite = session.isTeacher || board.writers.includes(user.id);

  const stage: ClassroomStageState = {
    strokes: board.strokes,
    equations: board.equations,
    plots: board.plots,
    onStroke: boardApi.addStroke,
    onEquation: boardApi.addEquation,
    onPlot: boardApi.addPlot,
    onClear: boardApi.clearBoard,
    canWrite,
    canClear: session.isTeacher,
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
      setChatText("");
      broadcast({ kind: "chat", line: { id: `ch-${Date.now().toString(36)}`, identity: user.id, name: user.name, text, at: new Date().toISOString() } });
    },
    writers: board.writers,
    avAllowed: board.avAllowed,
    onGrantWrite: (identity, allowedWrite) => void grant(identity, { canWriteBoard: allowedWrite }),
    onGrantAv: (identity, allowedAv) => void grant(identity, { canPublishAv: allowedAv }),
    onEndClass: () => void endClass(),
    onRestartClass: () => void restartClass(),
    ended: board.ended,
    muted,
    cameraOff,
    onToggleMute: () => setMuted((value) => !value),
    onToggleCamera: () => setCameraOff((value) => !value),
  };

  const demoRoster: RosterEntry[] = useMemo(() => [{ identity: user.id, name: user.name, isLocal: true }], [user.id, user.name]);

  if (loading || (allowed && !boardApi.loaded)) return <ClassroomTokenSkeleton />;
  if (!allowed) return <AccessDenied error={session.error} errorAr={session.errorAr} />;

  const demoAvAllowed = Boolean(session.isTeacher || session.canPublishAv);
  const errors = actionError.error ? actionError : boardApi.boardError;

  return (
    <main className="live-classroom-page mm-mobile-stack">
      <ApiErrorBanner error={errors.error} errorAr={errors.errorAr} className="live-token-error" />
      <p className="muted live-sync-hint" role="status">
        {live ? t.syncLive : t.syncDemo}
      </p>
      {!live ? (
        <MediaPermissionBanner
          tone="info"
          error={demoAvAllowed ? t.demoPreview : t.demoNoAv}
          errorAr={demoAvAllowed ? t.demoPreview : t.demoNoAv}
          hint={mediaPermissionCopy("both").hint}
          hintAr={mediaPermissionCopy("both").hintAr}
          hintFr={mediaPermissionCopy("both").hintFr}
        />
      ) : null}
      {live ? (
        <LiveKitClassroom
          session={session}
          userId={user.id}
          avAllowed={board.avAllowed}
          onRemote={applyRemote}
          onSend={(nextSend) => {
            sendRef.current = nextSend;
          }}
          onReconnected={() => void boardApi.pullBoard()}
          stage={stage}
        />
      ) : (
        <ClassroomStage
          session={session}
          userId={user.id}
          stage={stage}
          roster={demoRoster}
          rosterNotice={t.demoRoster}
          video={demoAvAllowed ? <DemoLocalAvPreview enabled muted={muted} cameraOff={cameraOff} /> : undefined}
        />
      )}
    </main>
  );
}
