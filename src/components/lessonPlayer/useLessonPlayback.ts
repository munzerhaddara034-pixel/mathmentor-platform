"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  audioLanguages,
  availableRenditions,
  initialLanguage,
  playbackPlan,
  type LessonLang,
  type LessonManifest,
  type Rendition,
} from "@/lib/lessonPlayer/manifest";
import { pickRendition } from "@/lib/lessonPlayer/rendition";
import { AudioVideoSync } from "@/lib/lessonPlayer/sync";
import { bindVideoEvents, initialMediaState, mediaReducer, readConnection, type Patch } from "./mediaState";
import type { QualityChoice } from "./SettingsMenu";

type SrcRef = { current: string | null };

/** Point video + narration at the sources for `lang` / `rendition`, keeping position and play state. */
async function switchSources(sync: AudioVideoSync, manifest: LessonManifest, lang: LessonLang, rendition: Rendition | null, srcRef: SrcRef) {
  const plan = playbackPlan(manifest, lang);
  const master = rendition ? manifest.video[rendition] : undefined;
  const targetVideo = plan.mode === "muxed" ? plan.src : master;
  const swapVideo = async () => {
    if (!targetVideo || srcRef.current === targetVideo) return;
    srcRef.current = targetVideo;
    await sync.setVideoSource(targetVideo);
  };
  if (plan.mode === "synced") {
    await swapVideo();
    await sync.setAudioSource(plan.audio);
  } else {
    await sync.setAudioSource(null);
    await swapVideo();
  }
  return plan.mode;
}

/** Controller lifecycle + every user action of the lesson player. */
export function useLessonPlayback(manifest: LessonManifest, uiLocale: string) {
  const langs = useMemo(() => audioLanguages(manifest), [manifest]);
  const renditions = useMemo(() => availableRenditions(manifest), [manifest]);
  const [media, patch] = useReducer(mediaReducer, manifest.duration, initialMediaState);
  const [lang, setLang] = useState<LessonLang>(() => initialLanguage(manifest, uiLocale));
  const [quality, setQuality] = useState<QualityChoice>("auto");
  const [autoRendition, setAutoRendition] = useState<Rendition | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const syncRef = useRef<AudioVideoSync | null>(null);
  const srcRef = useRef<string | null>(null);
  const langRef = useRef(lang);
  const activeRendition: Rendition | null = quality === "auto" ? autoRendition : quality;
  const muxed = playbackPlan(manifest, lang).mode === "muxed";

  const apply = useCallback(
    async (next: LessonLang, rendition: Rendition | null) => {
      const sync = syncRef.current;
      if (!sync) return;
      const mode = await switchSources(sync, manifest, next, rendition, srcRef);
      if (langRef.current === next) patch({ notice: mode === "silent" ? "noAudio" : null });
    },
    [manifest],
  );

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    const sync = createSync(video, audio, patch);
    syncRef.current = sync;
    const unbind = bindVideoEvents(video, sync, patch);
    const width = frameRef.current?.getBoundingClientRect().width || window.innerWidth;
    const auto = pickRendition({ width, devicePixelRatio: window.devicePixelRatio, connection: readConnection(), available: renditions });
    setAutoRendition(auto);
    void apply(langRef.current, auto);
    const onFullscreen = () => patch({ fullscreen: document.fullscreenElement === frameRef.current });
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      unbind();
      document.removeEventListener("fullscreenchange", onFullscreen);
      sync.destroy();
      syncRef.current = null;
      srcRef.current = null;
    };
  }, [apply, renditions]);

  // Sound lives on the narration <audio> (synced) or on the video itself (muxed fallback).
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    audio.muted = muted;
    audio.volume = volume;
    video.muted = muxed ? muted : true;
    video.volume = volume;
  }, [muted, volume, muxed]);

  const actions = {
    changeLang(next: LessonLang) {
      if (next === langRef.current) return;
      langRef.current = next;
      setLang(next);
      patch({ notice: null });
      void apply(next, activeRendition);
    },
    changeQuality(choice: QualityChoice) {
      setQuality(choice);
      const rendition = choice === "auto" ? autoRendition : choice;
      const src = rendition ? manifest.video[rendition] : undefined;
      const sync = syncRef.current;
      if (!sync || !src || muxed || srcRef.current === src) return;
      srcRef.current = src;
      void sync.setVideoSource(src);
    },
    togglePlay() {
      const sync = syncRef.current;
      if (!sync) return;
      if (sync.state.intent) {
        sync.pause();
        patch({ playing: false });
        return;
      }
      patch({ playing: true, notice: media.notice === "audioBlocked" ? null : media.notice });
      void sync.play().then(() => patch({ playing: sync.state.intent }));
    },
    seek: (time: number) => syncRef.current?.seek(time),
    seekBy: (seconds: number) => syncRef.current?.seek((videoRef.current?.currentTime ?? 0) + seconds),
    setRate: (rate: number) => syncRef.current?.setRate(rate),
    toggleMute: () => setMuted((value) => !value),
    setVolume(value: number) {
      setVolume(Math.min(1, Math.max(0, Math.round(value * 100) / 100)));
      setMuted(false);
    },
    toggleFullscreen() {
      const frame = frameRef.current;
      const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
      if (!frame) return;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      else if (frame.requestFullscreen) void frame.requestFullscreen().catch(() => undefined);
      else video?.webkitEnterFullscreen?.();
    },
  };

  return { media, lang, langs, renditions, quality, activeRendition, muted, volume, muxed, refs: { frameRef, videoRef, audioRef }, actions };
}

function createSync(video: HTMLVideoElement, audio: HTMLAudioElement, patch: Patch) {
  return new AudioVideoSync(video, audio, {
    onHold: (holding) => patch({ holding }),
    onSwitching: (switching) => patch({ switching }),
    onAudioError: () => patch({ notice: "audioError" }),
    onAudioBlocked: () => patch({ notice: "audioBlocked" }),
  });
}

export type LessonPlayback = ReturnType<typeof useLessonPlayback>;
