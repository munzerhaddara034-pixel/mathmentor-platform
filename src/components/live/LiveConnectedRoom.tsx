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
  useLocalParticipantPermissions,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, MediaDeviceFailure, RoomEvent, Track } from "livekit-client";
import "@livekit/components-styles";
import type { ClassroomDataMessage, ClassroomTokenPayload } from "@/lib/livekit/protocol";
import { LIVEKIT_DATA_TOPIC } from "@/lib/livekit/protocol";
import { LOW_DATA_ROOM_OPTIONS, LOW_DATA_SCREEN_CAPTURE, LOW_DATA_SCREEN_PUBLISH } from "@/lib/livekit/lowData";
import { enableLocalParticipantAv } from "@/lib/media/enableLocalAv";
import { mediaPermissionCopy, permissionErrorFromUnknown } from "@/lib/media/permissionCopy";
import { AudioOnlyToggle } from "./AudioOnlyToggle";
import { ClassroomStage, type ClassroomStageState } from "./ClassroomStage";
import { MediaPermissionBanner } from "./MediaPermissionBanner";
import { NetworkQualityBadge } from "./NetworkQualityBadge";
import { useAudioOnly } from "./useAudioOnly";
import { useNs } from "@/components/i18n/useNs";
import { liveMessages, type LiveMessages } from "@/lib/i18n/ns/live";

type Props = {
  session: ClassroomTokenPayload;
  userId: string;
  /** Live AV grants from the room store (teacher toggles). */
  avAllowed: string[];
  onRemote: (message: ClassroomDataMessage) => void;
  onSend: (send: (message: ClassroomDataMessage) => void) => void;
  /** Called after (re)connecting so the board can catch up with one `since` request. */
  onReconnected: () => void;
  stage: ClassroomStageState;
};

type MediaBanner = {
  error?: string;
  errorAr?: string;
  errorFr?: string;
  hint?: string;
  hintAr?: string;
  hintFr?: string;
};

type RoomCopy = LiveMessages["room"];

const decoder = new TextDecoder();
const encoder = new TextEncoder();


function kindFromMediaDevice(kind?: MediaDeviceKind): "microphone" | "camera" | "both" {
  if (kind === "audioinput") return "microphone";
  if (kind === "videoinput") return "camera";
  return "both";
}

function partialFailureBanner(
  micOk: boolean,
  camOk: boolean,
  failure: MediaBanner,
  t: RoomCopy,
): MediaBanner {
  if (micOk && !camOk) {
    return {
      ...failure,
      error: failure.error ? `${t.camFailed} ${failure.error}` : t.camFailed,
      errorAr: failure.errorAr ? `${t.camFailed} ${failure.errorAr}` : t.camFailed,
      errorFr: failure.errorFr ? `${t.camFailed} ${failure.errorFr}` : t.camFailed,
    };
  }
  if (!micOk && camOk) {
    return {
      ...failure,
      error: failure.error ? `${t.micFailed} ${failure.error}` : t.micFailed,
      errorAr: failure.errorAr ? `${t.micFailed} ${failure.errorAr}` : t.micFailed,
      errorFr: failure.errorFr ? `${t.micFailed} ${failure.errorFr}` : t.micFailed,
    };
  }
  return failure;
}

function ConnectedShell({
  session,
  userId,
  avAllowed,
  onRemote,
  onSend,
  onReconnected,
  stage,
  mediaBanner,
  onEnableAv,
  onEnableFailure,
}: Props & {
  mediaBanner: MediaBanner | null;
  onEnableAv: () => void;
  onEnableFailure: (banner: MediaBanner | null) => void;
}) {
  const t = useNs(liveMessages).room;
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
  const { audioOnly, setAudioOnly } = useAudioOnly(room);
  const enableLabel = audioOnly ? t.enableMic : t.enableAv;
  const permissions = useLocalParticipantPermissions();

  useEffect(() => {
    onSend((message) => {
      void send(encoder.encode(JSON.stringify(message)), { reliable: true }).catch(() => undefined);
    });
  }, [onSend, send]);

  // Board catch-up only on (re)connect — no interval polling while LiveKit is connected.
  useEffect(() => {
    const onConnected = () => onReconnected();
    room.on(RoomEvent.Reconnected, onConnected);
    room.on(RoomEvent.Connected, onConnected);
    return () => {
      room.off(RoomEvent.Reconnected, onConnected);
      room.off(RoomEvent.Connected, onConnected);
    };
  }, [onReconnected, room]);

  // Publish rights follow the server live: LiveKit permission updates (teacher grant/revoke)
  // win; before the first update we fall back to the token grant + room-store list.
  const canPublish =
    session.isTeacher ||
    (permissions ? permissions.canPublish : session.canPublishAv || avAllowed.includes(userId));
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
        ...mediaPermissionCopy("both"),
        error: t.stillConnecting,
        errorAr: t.stillConnecting,
        errorFr: t.stillConnecting,
      });
      return;
    }
    setEnabling(true);
    void (async () => {
      try {
        const result = await enableLocalParticipantAv(localParticipant, { camera: !audioOnly });
        if (result.micOk && (result.camOk || audioOnly)) {
          onEnableFailure(null);
          return;
        }
        if (result.failure) {
          onEnableFailure(partialFailureBanner(result.micOk, result.camOk, result.failure, t));
          return;
        }
        onEnableFailure(mediaPermissionCopy("both"));
      } catch (error) {
        onEnableFailure(permissionErrorFromUnknown(error, "both"));
      } finally {
        setEnabling(false);
      }
    })();
  }, [audioOnly, canPublish, localParticipant, onEnableAv, onEnableFailure, roomConnected, t]);

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
          aria-label={audioOnly ? t.tapAudio : t.tapAv}
        >
          <span className="live-av-overlay-cta-label">
            {enabling ? t.connecting : audioOnly ? t.tapAudio : t.tapAv}
          </span>
          <span className="live-av-overlay-cta-sub">{enableLabel}</span>
        </button>
      ) : null}
      {showConnectingOverlay ? (
        <div className="live-av-overlay-cta live-av-overlay-connecting" role="status" aria-live="polite">
          <span className="live-av-overlay-cta-label">{t.connecting}</span>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <RoomAudioRenderer />
      {!roomConnected ? (
        <MediaPermissionBanner tone="info" error={t.connecting} errorAr={t.connecting} />
      ) : null}
      {mediaBanner ? (
        <MediaPermissionBanner
          error={mediaBanner.error}
          errorAr={mediaBanner.errorAr}
          errorFr={mediaBanner.errorFr}
          hint={mediaBanner.hint}
          hintAr={mediaBanner.hintAr}
          hintFr={mediaBanner.hintFr}
          retryLabel={enableLabel}
          onRetry={enableAv}
        />
      ) : null}
      {needsEnableNudge ? (
        <MediaPermissionBanner
          tone="info"
          error={t.avOff}
          errorAr={t.avOff}
          hint={mediaPermissionCopy("both").hint}
          hintAr={mediaPermissionCopy("both").hintAr}
          hintFr={mediaPermissionCopy("both").hintFr}
          retryLabel={enableLabel}
          onRetry={enableAv}
        />
      ) : null}
      <ClassroomStage
        session={session}
        userId={userId}
        stage={stage}
        roster={roster}
        video={videoPane}
        mediaExtras={
          <div className="live-media-extras">
            <NetworkQualityBadge participant={localParticipant} />
            <AudioOnlyToggle audioOnly={audioOnly} onChange={setAudioOnly} />
          </div>
        }
        avControls={
          canPublish ? (
            <div className="live-av-toggles">
              <TrackToggle source={Track.Source.Microphone}>{t.mic}</TrackToggle>
              {audioOnly ? null : <TrackToggle source={Track.Source.Camera}>{t.camera}</TrackToggle>}
              {session.isTeacher ? (
                <TrackToggle
                  source={Track.Source.ScreenShare}
                  captureOptions={LOW_DATA_SCREEN_CAPTURE}
                  publishOptions={LOW_DATA_SCREEN_PUBLISH}
                >
                  {t.shareScreen}
                </TrackToggle>
              ) : null}
              <button
                className="btn dark live-av-enable-btn"
                type="button"
                onClick={enableAv}
                disabled={enabling || !roomConnected}
              >
                {!roomConnected ? t.connecting : enabling ? "…" : enableLabel}
              </button>
            </div>
          ) : (
            <p className="muted">{t.avLocked}</p>
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
      setMediaBanner(permissionErrorFromUnknown({ name: "NotAllowedError", message: "Permission denied." }, mappedKind));
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
      options={LOW_DATA_ROOM_OPTIONS}
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
