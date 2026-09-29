"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chat,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, MediaDeviceFailure, Track } from "livekit-client";
import "@livekit/components-styles";
import type { ClassroomDataMessage, ClassroomTokenPayload } from "@/lib/livekit/protocol";
import { LIVEKIT_DATA_TOPIC } from "@/lib/livekit/protocol";
import { enableLocalParticipantAv } from "@/lib/media/enableLocalAv";
import { mediaPermissionCopy, permissionErrorFromUnknown } from "@/lib/media/permissionCopy";
import { ClassroomStage, type ClassroomStageState } from "./ClassroomStage";
import { MediaPermissionBanner } from "./MediaPermissionBanner";

type Props = {
  session: ClassroomTokenPayload;
  userId: string;
  onRemote: (message: ClassroomDataMessage) => void;
  onSend: (send: (message: ClassroomDataMessage) => void) => void;
  stage: ClassroomStageState;
};

type MediaBanner = {
  error?: string;
  errorAr?: string;
  hint?: string;
  hintAr?: string;
};

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const ENABLE_LABEL = "تفعيل الكاميرا والميكروفون";
const OVERLAY_CTA = "اضغط لتفعيل الكاميرا والصوت";
const CONNECTING_LABEL = "جاري الاتصال…";

function kindFromMediaDevice(kind?: MediaDeviceKind): "microphone" | "camera" | "both" {
  if (kind === "audioinput") return "microphone";
  if (kind === "videoinput") return "camera";
  return "both";
}

function partialFailureBanner(
  micOk: boolean,
  camOk: boolean,
  failure: MediaBanner,
): MediaBanner {
  if (micOk && !camOk) {
    return {
      error: failure.error ?? "Camera failed; microphone is on.",
      errorAr: failure.errorAr
        ? `الميكروفون يعمل. الكاميرا فشلت: ${failure.errorAr}`
        : "الميكروفون يعمل لكن تعذّر تشغيل الكاميرا.",
      hint: failure.hint,
      hintAr: failure.hintAr,
    };
  }
  if (!micOk && camOk) {
    return {
      error: failure.error ?? "Microphone failed; camera is on.",
      errorAr: failure.errorAr
        ? `الكاميرا تعمل. الميكروفون فشل: ${failure.errorAr}`
        : "الكاميرا تعمل لكن تعذّر تشغيل الميكروفون.",
      hint: failure.hint,
      hintAr: failure.hintAr,
    };
  }
  return failure;
}

function ConnectedShell({
  session,
  userId,
  onRemote,
  onSend,
  stage,
  mediaBanner,
  onEnableAv,
  onEnableFailure,
}: Props & {
  mediaBanner: MediaBanner | null;
  onEnableAv: () => void;
  onEnableFailure: (banner: MediaBanner | null) => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState(room);
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const { send } = useDataChannel(LIVEKIT_DATA_TOPIC, (packet) => {
    try {
      const parsed = JSON.parse(decoder.decode(packet.payload)) as ClassroomDataMessage;
      onRemote(parsed);
    } catch {
      /* ignore malformed payloads */
    }
  });

  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    onSend((message) => {
      void send(encoder.encode(JSON.stringify(message)), { reliable: true });
    });
  }, [onSend, send]);

  const canPublish = session.isTeacher || session.canPublishAv;
  const roomConnected = connectionState === ConnectionState.Connected;
  const avLive = isMicrophoneEnabled || isCameraEnabled;
  const needsEnableNudge = canPublish && !avLive && !mediaBanner && roomConnected && !enabling;

  const roster = useMemo(
    () =>
      participants.map((participant) => ({
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: participant.isLocal,
      })),
    [participants],
  );

  const enableAv = useCallback(() => {
    onEnableAv();
    if (!canPublish) return;
    if (!roomConnected) {
      onEnableFailure({
        error: "Still connecting to the classroom…",
        errorAr: CONNECTING_LABEL,
        hint: mediaPermissionCopy("both").hint,
        hintAr: mediaPermissionCopy("both").hintAr,
      });
      return;
    }
    setEnabling(true);
    void (async () => {
      try {
        const result = await enableLocalParticipantAv(localParticipant);
        if (result.micOk && result.camOk) {
          onEnableFailure(null);
          return;
        }
        if (result.failure) {
          onEnableFailure(partialFailureBanner(result.micOk, result.camOk, result.failure));
          return;
        }
        onEnableFailure(mediaPermissionCopy("both"));
      } catch (error) {
        onEnableFailure(permissionErrorFromUnknown(error, "both"));
      } finally {
        setEnabling(false);
      }
    })();
  }, [canPublish, localParticipant, onEnableAv, onEnableFailure, roomConnected]);

  const showAvOverlay = canPublish && !avLive && roomConnected;
  const showConnectingOverlay = canPublish && !roomConnected;
  const videoPane = (
    <div
      className={
        showAvOverlay || showConnectingOverlay
          ? "live-video-stage live-video-stage--awaiting-av"
          : "live-video-stage"
      }
    >
      <GridLayout tracks={tracks} className="live-video-grid">
        <ParticipantTile />
      </GridLayout>
      {showAvOverlay ? (
        <button
          type="button"
          className="live-av-overlay-cta"
          onClick={enableAv}
          disabled={enabling}
          aria-label={OVERLAY_CTA}
        >
          <span className="live-av-overlay-cta-label" dir="rtl" lang="ar">
            {enabling ? CONNECTING_LABEL : OVERLAY_CTA}
          </span>
          <span className="live-av-overlay-cta-sub" dir="ltr">
            Enable camera &amp; mic
          </span>
        </button>
      ) : null}
      {showConnectingOverlay ? (
        <div className="live-av-overlay-cta live-av-overlay-connecting" role="status" aria-live="polite">
          <span className="live-av-overlay-cta-label" dir="rtl" lang="ar">
            {CONNECTING_LABEL}
          </span>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <RoomAudioRenderer />
      {!roomConnected ? (
        <MediaPermissionBanner tone="info" error="Connecting…" errorAr={CONNECTING_LABEL} />
      ) : null}
      {mediaBanner ? (
        <MediaPermissionBanner
          error={mediaBanner.error}
          errorAr={mediaBanner.errorAr}
          hint={mediaBanner.hint}
          hintAr={mediaBanner.hintAr}
          retryLabel={ENABLE_LABEL}
          onRetry={enableAv}
        />
      ) : null}
      {needsEnableNudge ? (
        <MediaPermissionBanner
          tone="info"
          error="Camera and microphone are off. Tap the overlay or the button below (browser may ask for permission)."
          errorAr="الكاميرا والميكروفون مطفآن. اضغط على الفيديو أو الزر أدناه (قد يطلب المتصفح الإذن)."
          hint={mediaPermissionCopy("both").hint}
          hintAr={mediaPermissionCopy("both").hintAr}
          retryLabel={ENABLE_LABEL}
          onRetry={enableAv}
        />
      ) : null}
      <ClassroomStage
        session={session}
        userId={userId}
        stage={stage}
        roster={roster}
        video={videoPane}
        avControls={
          canPublish ? (
            <div className="live-av-toggles">
              <TrackToggle source={Track.Source.Microphone}>صوت / Mic</TrackToggle>
              <TrackToggle source={Track.Source.Camera}>كاميرا / Camera</TrackToggle>
              <button
                className="btn dark live-av-enable-btn"
                type="button"
                onClick={enableAv}
                disabled={enabling || !roomConnected}
              >
                {!roomConnected ? CONNECTING_LABEL : enabling ? "…" : ENABLE_LABEL}
              </button>
            </div>
          ) : (
            <p className="muted">
              الكاميرا والصوت مقفولان حتى يسمح الأستاذ. / AV locked until the teacher grants publish.
            </p>
          )
        }
        chat={<Chat />}
        onLeave={() => room.disconnect()}
      />
    </>
  );
}

export function LiveKitClassroom(props: Props) {
  const url = props.session.serverUrl;
  const token = props.session.token;
  const [mediaBanner, setMediaBanner] = useState<MediaBanner | null>(null);

  const applyFailure = useCallback((failure?: MediaDeviceFailure, kind?: MediaDeviceKind) => {
    const mappedKind = kindFromMediaDevice(kind);
    if (failure === MediaDeviceFailure.PermissionDenied) {
      setMediaBanner(mediaPermissionCopy(mappedKind, "Permission denied."));
      return;
    }
    if (failure === MediaDeviceFailure.NotFound) {
      setMediaBanner(permissionErrorFromUnknown({ name: "NotFoundError", message: "NotFoundError" }, mappedKind));
      return;
    }
    if (failure === MediaDeviceFailure.DeviceInUse) {
      setMediaBanner(
        permissionErrorFromUnknown({ name: "NotReadableError", message: "NotReadableError" }, mappedKind),
      );
      return;
    }
    setMediaBanner(mediaPermissionCopy(mappedKind, failure ? String(failure) : undefined));
  }, []);

  const onEnableAv = useCallback(() => {
    setMediaBanner(null);
  }, []);

  if (!url || !token) return null;

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      audio={false}
      video={false}
      onMediaDeviceFailure={applyFailure}
      onError={(error) => {
        if (/permission|notallowed|device/i.test(error.message)) {
          setMediaBanner(permissionErrorFromUnknown(error, "both"));
        }
      }}
      data-lk-theme="default"
      className="live-lk-room"
    >
      <ConnectedShell
        {...props}
        mediaBanner={mediaBanner}
        onEnableAv={onEnableAv}
        onEnableFailure={setMediaBanner}
      />
    </LiveKitRoom>
  );
}
