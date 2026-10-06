import type { ConnectionHint } from "@/lib/lessonPlayer/rendition";
import type { AudioVideoSync } from "@/lib/lessonPlayer/sync";

export type Notice = "audioError" | "audioBlocked" | "videoError" | "noAudio";

/** UI mirror of the media elements (driven by their events). */
export type MediaState = {
  ready: boolean;
  playing: boolean;
  ended: boolean;
  time: number;
  duration: number;
  buffered: number;
  rate: number;
  holding: boolean;
  switching: boolean;
  videoWaiting: boolean;
  notice: Notice | null;
  fullscreen: boolean;
};

export type Patch = (patch: Partial<MediaState>) => void;

export function initialMediaState(duration: number): MediaState {
  return {
    ready: false,
    playing: false,
    ended: false,
    time: 0,
    duration,
    buffered: 0,
    rate: 1,
    holding: false,
    switching: false,
    videoWaiting: false,
    notice: null,
    fullscreen: false,
  };
}

export function mediaReducer(state: MediaState, patch: Partial<MediaState>): MediaState {
  return { ...state, ...patch };
}

export function readConnection(): ConnectionHint | null {
  const nav = navigator as Navigator & { connection?: ConnectionHint };
  return nav.connection ?? null;
}

/** Wire <video> events to UI state. `sync` listeners are registered first, so its play intent is current here. */
export function bindVideoEvents(video: HTMLVideoElement, sync: AudioVideoSync, patch: Patch): () => void {
  const buffered = () => {
    const ranges = video.buffered;
    patch({ buffered: ranges.length ? ranges.end(ranges.length - 1) : 0 });
  };
  const handlers: Array<[string, () => void]> = [
    ["loadedmetadata", () => patch(Number.isFinite(video.duration) && video.duration > 0 ? { ready: true, duration: video.duration } : { ready: true })],
    ["timeupdate", () => patch({ time: video.currentTime })],
    ["seeked", () => patch({ time: video.currentTime })],
    ["progress", buffered],
    ["play", () => patch({ playing: sync.state.intent, ended: false })],
    ["playing", () => patch({ playing: sync.state.intent, videoWaiting: false })],
    ["pause", () => patch({ playing: sync.state.intent })],
    ["waiting", () => patch({ videoWaiting: true })],
    ["canplay", () => patch({ videoWaiting: false })],
    ["ended", () => patch({ ended: true, playing: false })],
    ["ratechange", () => patch({ rate: video.playbackRate })],
    ["error", () => (video.error ? patch({ notice: "videoError" }) : undefined)],
  ];
  for (const [type, fn] of handlers) video.addEventListener(type, fn);
  return () => {
    for (const [type, fn] of handlers) video.removeEventListener(type, fn);
  };
}
