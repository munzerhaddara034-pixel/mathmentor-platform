/**
 * Keeps a hidden narration <audio> element locked to a silent master <video>.
 *
 * The video is the clock. Audio follows play / pause / seek / rate / buffering, and drift is corrected on every
 * `timeupdate`: drift under 80 ms (about two video frames, below what a viewer notices) is ignored; more is absorbed by nudging the audio playbackRate (inaudible ±5 %), large drift by a hard seek.
 * If the AUDIO stalls, the video is held (paused without changing the user's play intent) until audio can play again.
 * Switching language swaps the audio source while the video holds its frame, then resumes at the same position and
 * play state. Swapping the video rendition works the same way. DOM-free (works against `MediaLike`) so it is unit-tested.
 */

export interface MediaLike {
  currentTime: number;
  playbackRate: number;
  src: string;
  readonly paused: boolean;
  readonly readyState: number;
  readonly duration: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute?(name: string): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export type DriftOptions = {
  /** |drift| at or above this (s) → hard seek. */
  hardSeek: number;
  /** |drift| below this (s) → no correction. */
  tolerance: number;
  /** Rate change per second of drift. */
  gain: number;
  /** Maximum relative rate nudge. */
  maxNudge: number;
};

export const DEFAULT_DRIFT: DriftOptions = { hardSeek: 0.3, tolerance: 0.08, gain: 0.5, maxNudge: 0.05 };

export type DriftAction = { kind: "none"; rate: number } | { kind: "nudge"; rate: number; drift: number } | { kind: "seek"; time: number; drift: number };

/** Pure drift policy. `drift = audioTime - videoTime` (positive = audio ahead → slow it down). */
export function driftAction(videoTime: number, audioTime: number, baseRate: number, options: DriftOptions = DEFAULT_DRIFT): DriftAction {
  const drift = audioTime - videoTime;
  if (!Number.isFinite(drift)) return { kind: "none", rate: baseRate };
  const size = Math.abs(drift);
  if (size >= options.hardSeek) return { kind: "seek", time: videoTime, drift };
  if (size <= options.tolerance) return { kind: "none", rate: baseRate };
  const nudge = Math.max(-options.maxNudge, Math.min(options.maxNudge, drift * options.gain));
  return { kind: "nudge", rate: baseRate * (1 - nudge), drift };
}

export type SyncCallbacks = {
  /** Video paused because the narration is buffering (true) / resumed (false). */
  onHold?: (holding: boolean) => void;
  /** A language / rendition swap started (true) or finished (false). */
  onSwitching?: (switching: boolean) => void;
  onAudioError?: () => void;
  /** audio.play() was refused (autoplay policy); the video keeps playing silently. */
  onAudioBlocked?: () => void;
};

const HAVE_METADATA = 1;

function waitForMetadata(media: MediaLike): Promise<void> {
  if (media.readyState >= HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      media.removeEventListener("loadedmetadata", done);
      media.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      media.removeEventListener("loadedmetadata", done);
      media.removeEventListener("error", fail);
      reject(new Error("media error"));
    };
    media.addEventListener("loadedmetadata", done);
    media.addEventListener("error", fail);
  });
}

export class AudioVideoSync {
  readonly video: MediaLike;
  readonly audio: MediaLike;
  private callbacks: SyncCallbacks;
  private drift: DriftOptions;
  private intent = false;
  private holding = false;
  private switching = false;
  private audioActive = false;
  private baseRate = 1;
  private token = 0;
  private blockedReported = false;
  private bound: Array<[MediaLike, string, () => void]> = [];

  constructor(video: MediaLike, audio: MediaLike, callbacks: SyncCallbacks = {}, drift: DriftOptions = DEFAULT_DRIFT) {
    this.video = video;
    this.audio = audio;
    this.callbacks = callbacks;
    this.drift = drift;
    this.baseRate = video.playbackRate || 1;
    this.on(video, "play", () => this.onVideoPlay());
    this.on(video, "playing", () => this.startAudio());
    this.on(video, "pause", () => this.onVideoPause());
    this.on(video, "seeking", () => this.onVideoSeeking());
    this.on(video, "seeked", () => this.onVideoSeeked());
    this.on(video, "waiting", () => this.audioActive && this.audio.pause());
    this.on(video, "ratechange", () => this.onRate());
    this.on(video, "timeupdate", () => this.correctDrift());
    this.on(video, "ended", () => this.onEnded());
    this.on(audio, "waiting", () => this.onAudioWaiting());
    this.on(audio, "stalled", () => this.onAudioWaiting());
    this.on(audio, "canplay", () => this.onAudioReady());
    this.on(audio, "playing", () => this.onAudioReady());
    this.on(audio, "error", () => this.audioActive && this.callbacks.onAudioError?.());
  }

  private on(target: MediaLike, type: string, listener: () => void) {
    target.addEventListener(type, listener);
    this.bound.push([target, type, listener]);
  }

  destroy() {
    for (const [target, type, listener] of this.bound) target.removeEventListener(type, listener);
    this.bound = [];
    this.token += 1;
  }

  get state() {
    return { intent: this.intent, holding: this.holding, switching: this.switching, audioActive: this.audioActive, baseRate: this.baseRate };
  }

  /** Clamp a video time into the audio's duration (narration is meant to be exactly as long as the video). */
  private audioTimeFor(videoTime: number): number {
    const d = this.audio.duration;
    return Number.isFinite(d) && d > 0 ? Math.min(Math.max(videoTime, 0), Math.max(d - 0.01, 0)) : Math.max(videoTime, 0);
  }

  private align() {
    if (!this.audioActive || this.audio.readyState < HAVE_METADATA) return;
    if (Math.abs(this.audio.currentTime - this.video.currentTime) > this.drift.tolerance) {
      this.audio.currentTime = this.audioTimeFor(this.video.currentTime);
    }
  }

  private startAudio() {
    if (!this.audioActive || this.video.paused || this.switching) return;
    this.align();
    this.audio.playbackRate = this.baseRate;
    if (this.audio.paused) this.playAudio();
  }

  /** Start the narration; an autoplay refusal is reported once until a play succeeds. */
  private playAudio() {
    this.audio.play().then(
      () => {
        this.blockedReported = false;
      },
      (error: unknown) => {
        if (error instanceof Error && error.name === "NotAllowedError" && !this.blockedReported) {
          this.blockedReported = true;
          this.callbacks.onAudioBlocked?.();
        }
      },
    );
  }

  private onVideoPlay() {
    if (!this.holding && !this.switching) this.intent = true;
    this.startAudio();
  }

  private onVideoPause() {
    if (!this.holding && !this.switching) this.intent = false;
    if (this.audioActive) this.audio.pause();
  }

  private onVideoSeeking() {
    if (!this.audioActive) return;
    this.audio.pause();
    if (this.audio.readyState >= HAVE_METADATA) this.audio.currentTime = this.audioTimeFor(this.video.currentTime);
  }

  private onVideoSeeked() {
    if (!this.audioActive) return;
    this.align();
    this.startAudio();
  }

  private onRate() {
    this.baseRate = this.video.playbackRate || 1;
    if (this.audioActive) this.audio.playbackRate = this.baseRate;
  }

  private onEnded() {
    this.intent = false;
    if (this.audioActive) this.audio.pause();
  }

  private setHolding(next: boolean) {
    if (this.holding === next) return;
    this.holding = next;
    this.callbacks.onHold?.(next);
  }

  private onAudioWaiting() {
    if (!this.audioActive || this.switching || !this.intent || this.video.paused) return;
    this.setHolding(true);
    this.video.pause();
  }

  private onAudioReady() {
    if (!this.holding || this.switching) return;
    this.setHolding(false);
    if (this.intent) {
      this.align();
      void this.video.play().catch(() => undefined);
    }
  }

  /** Called on timeupdate (and by the UI's own ticker while playing). */
  correctDrift(): DriftAction | null {
    if (!this.audioActive || this.switching || this.holding || this.video.paused || this.audio.paused) return null;
    if (this.audio.readyState < HAVE_METADATA) return null;
    const action = driftAction(this.video.currentTime, this.audio.currentTime, this.baseRate, this.drift);
    if (action.kind === "seek") {
      this.audio.currentTime = this.audioTimeFor(action.time);
      this.audio.playbackRate = this.baseRate;
    } else if (this.audio.playbackRate !== action.rate) {
      this.audio.playbackRate = action.rate;
    }
    return action;
  }

  /** User play (call inside the click/key handler so iOS unlocks the audio element in the same gesture). */
  play(): Promise<void> {
    this.intent = true;
    if (this.audioActive && !this.switching) {
      this.align();
      this.audio.playbackRate = this.baseRate;
      if (this.audio.paused) this.playAudio();
    }
    if (this.switching) return Promise.resolve();
    return this.video.play().catch(() => {
      this.intent = false;
      if (this.audioActive) this.audio.pause();
    });
  }

  pause() {
    this.intent = false;
    this.setHolding(false);
    this.video.pause();
    if (this.audioActive) this.audio.pause();
  }

  toggle(): Promise<void> | void {
    return this.intent ? this.pause() : this.play();
  }

  seek(time: number) {
    const d = this.video.duration;
    const target = Number.isFinite(d) && d > 0 ? Math.min(Math.max(time, 0), d) : Math.max(time, 0);
    this.video.currentTime = target;
    if (this.audioActive && this.audio.readyState >= HAVE_METADATA) this.audio.currentTime = this.audioTimeFor(target);
  }

  setRate(rate: number) {
    this.video.playbackRate = rate;
    this.onRate();
  }

  private beginSwitch(): { token: number; wasPlaying: boolean } {
    const token = ++this.token;
    const wasPlaying = this.intent;
    this.switching = true;
    this.setHolding(false);
    this.callbacks.onSwitching?.(true);
    if (!this.video.paused) this.video.pause();
    this.audio.pause();
    return { token, wasPlaying };
  }

  private endSwitch(token: number, wasPlaying: boolean) {
    if (token !== this.token) return;
    this.switching = false;
    this.callbacks.onSwitching?.(false);
    this.intent = wasPlaying;
    if (wasPlaying) void this.play();
  }

  /**
   * Swap the narration (language switch). `null` detaches the external audio (muxed / silent playback).
   * Keeps the video position and play state; the video holds its frame while the new track loads.
   */
  async setAudioSource(src: string | null): Promise<void> {
    const { token, wasPlaying } = this.beginSwitch();
    if (!src) {
      this.audioActive = false;
      this.audio.removeAttribute?.("src");
      this.audio.load();
      this.endSwitch(token, wasPlaying);
      return;
    }
    this.audioActive = true;
    this.audio.src = src;
    this.audio.load();
    try {
      await waitForMetadata(this.audio);
    } catch {
      if (token === this.token) this.callbacks.onAudioError?.();
    }
    if (token !== this.token) return;
    if (this.audio.readyState >= HAVE_METADATA) this.audio.currentTime = this.audioTimeFor(this.video.currentTime);
    this.audio.playbackRate = this.baseRate;
    this.endSwitch(token, wasPlaying);
  }

  /** Swap the video source (rendition change, or muxed ↔ master) keeping position and play state. */
  async setVideoSource(src: string): Promise<void> {
    const position = this.video.currentTime;
    const rate = this.baseRate;
    const { token, wasPlaying } = this.beginSwitch();
    this.video.src = src;
    this.video.load();
    try {
      await waitForMetadata(this.video);
    } catch {
      // Leave the error to the UI's own video "error" listener.
    }
    if (token !== this.token) return;
    if (position > 0) this.video.currentTime = position;
    this.video.playbackRate = rate;
    this.endSwitch(token, wasPlaying);
  }
}
