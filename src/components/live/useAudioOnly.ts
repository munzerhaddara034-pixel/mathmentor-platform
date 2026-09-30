"use client";

import { useCallback, useEffect, useState } from "react";
import { RoomEvent, Track, type RemoteParticipant, type RemoteTrackPublication, type Room } from "livekit-client";
import { readAudioOnlyPreference, writeAudioOnlyPreference } from "@/lib/livekit/lowData";

function applyToPublication(publication: RemoteTrackPublication, audioOnly: boolean) {
  if (publication.source !== Track.Source.Camera) return;
  if (publication.isDesired === !audioOnly) return;
  publication.setSubscribed(!audioOnly);
}

function applyToParticipant(participant: RemoteParticipant, audioOnly: boolean) {
  participant.trackPublications.forEach((publication) => applyToPublication(publication, audioOnly));
}

/**
 * Audio-first data saver (default ON). When on: the local camera is turned off and remote
 * camera tracks are unsubscribed (screen share and audio stay). Preference is remembered.
 */
export function useAudioOnly(room: Room) {
  const [audioOnly, setAudioOnlyState] = useState<boolean>(readAudioOnlyPreference);

  useEffect(() => {
    room.remoteParticipants.forEach((participant) => applyToParticipant(participant, audioOnly));
    const onPublished = (publication: RemoteTrackPublication) => applyToPublication(publication, audioOnly);
    const onConnected = (participant: RemoteParticipant) => applyToParticipant(participant, audioOnly);
    room.on(RoomEvent.TrackPublished, onPublished);
    room.on(RoomEvent.ParticipantConnected, onConnected);
    return () => {
      room.off(RoomEvent.TrackPublished, onPublished);
      room.off(RoomEvent.ParticipantConnected, onConnected);
    };
  }, [audioOnly, room]);

  const setAudioOnly = useCallback(
    (next: boolean) => {
      setAudioOnlyState(next);
      writeAudioOnlyPreference(next);
      if (next && room.localParticipant.isCameraEnabled) {
        void room.localParticipant.setCameraEnabled(false).catch(() => undefined);
      }
    },
    [room],
  );

  return { audioOnly, setAudioOnly };
}
