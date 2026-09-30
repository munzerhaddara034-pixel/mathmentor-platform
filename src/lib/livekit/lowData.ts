/**
 * Low-data LiveKit defaults for Lebanese mobile connections (client-side).
 * - Receive: adaptiveStream (only the size actually rendered) + dynacast (pause unused layers).
 * - Camera: 360p capture, simulcast with a 180p layer; audio-first (camera off until asked).
 * - Audio: speech preset (24 kbps) with DTX (silence ≈ 0) and RED (loss resilience).
 * - Screen share: 720p at 5 fps — slides and handwriting stay sharp at ~0.8 Mbps max.
 */
import {
  AudioPresets,
  ScreenSharePresets,
  VideoPresets,
  type RoomOptions,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";

export const LOW_DATA_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h360.resolution,
    facingMode: "user",
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  publishDefaults: {
    simulcast: true,
    videoEncoding: VideoPresets.h360.encoding,
    videoSimulcastLayers: [VideoPresets.h180],
    audioPreset: AudioPresets.speech,
    dtx: true,
    red: true,
    screenShareEncoding: ScreenSharePresets.h720fps5.encoding,
    screenShareSimulcastLayers: [],
  },
};

export const LOW_DATA_SCREEN_CAPTURE: ScreenShareCaptureOptions = {
  audio: false,
  resolution: ScreenSharePresets.h720fps5.resolution,
  contentHint: "detail",
};

export const LOW_DATA_SCREEN_PUBLISH: TrackPublishOptions = {
  screenShareEncoding: ScreenSharePresets.h720fps5.encoding,
  simulcast: false,
};

export const AUDIO_ONLY_STORAGE_KEY = "mm-live-audio-only";

/** Audio-first by default; the student/teacher can opt into video. */
export function readAudioOnlyPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AUDIO_ONLY_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeAudioOnlyPreference(value: boolean) {
  try {
    window.localStorage.setItem(AUDIO_ONLY_STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* private mode — preference is per-session only */
  }
}
