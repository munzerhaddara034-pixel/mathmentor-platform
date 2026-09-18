"use client";

import { useEffect, useMemo } from "react";
import {
  Chat,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useDataChannel,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import type { ClassroomDataMessage, ClassroomTokenPayload } from "@/lib/livekit/protocol";
import { LIVEKIT_DATA_TOPIC } from "@/lib/livekit/protocol";
import { ClassroomStage, type ClassroomStageState } from "./ClassroomStage";

type Props = {
  session: ClassroomTokenPayload;
  userId: string;
  onRemote: (message: ClassroomDataMessage) => void;
  onSend: (send: (message: ClassroomDataMessage) => void) => void;
  stage: ClassroomStageState;
};

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function ConnectedShell({ session, userId, onRemote, onSend, stage }: Props) {
  const room = useRoomContext();
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

  useEffect(() => {
    onSend((message) => {
      void send(encoder.encode(JSON.stringify(message)), { reliable: true });
    });
  }, [onSend, send]);

  const roster = useMemo(
    () =>
      participants.map((participant) => ({
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: participant.isLocal,
      })),
    [participants],
  );

  return (
    <>
      <RoomAudioRenderer />
      <ClassroomStage
        session={session}
        userId={userId}
        stage={stage}
        roster={roster}
        video={
          <GridLayout tracks={tracks} className="live-video-grid">
            <ParticipantTile />
          </GridLayout>
        }
        avControls={
          session.isTeacher || session.canPublishAv ? (
            <div className="live-av-toggles">
              <TrackToggle source={Track.Source.Microphone}>صوت / Mic</TrackToggle>
              <TrackToggle source={Track.Source.Camera}>كاميرا / Camera</TrackToggle>
            </div>
          ) : (
            <p className="muted">الكاميرا والصوت مقفولان حتى يسمح الأستاذ. / AV locked until the teacher grants publish.</p>
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
  if (!url || !token) return null;
  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      audio={props.session.isTeacher || props.session.canPublishAv}
      video={props.session.isTeacher || props.session.canPublishAv}
      data-lk-theme="default"
      className="live-lk-room"
    >
      <ConnectedShell {...props} />
    </LiveKitRoom>
  );
}

