"use client";

import { useEffect, useRef } from "react";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";

export type VideoClockSource = "raf" | "timeupdate" | "seeked" | "play" | "pause" | "ratechange";

type Props = {
  language: LessonLocale;
  speaking: boolean;
  frozen: boolean;
  playing: boolean;
  currentTime: number;
  playbackRate?: number;
  videoUrl?: string;
  audioUrl?: string;
  poster?: string;
  teacherName?: string;
  /** When true, this panel is the clock: video.currentTime drives the canvas. */
  clockMaster?: boolean;
  seekEpoch?: number;
  seekTo?: number;
  onTime?: (time: number, source?: VideoClockSource) => void;
  onEnded?: () => void;
  onError?: () => void;
  onDuration?: (duration: number) => void;
};

const DEFAULT_POSTER = "/teachers/munzer.jpg?v=4";

export function AvatarPlayer({
  language,
  speaking,
  frozen,
  playing,
  currentTime,
  playbackRate = 1,
  videoUrl,
  audioUrl,
  poster = DEFAULT_POSTER,
  teacherName = "Prof. Munzer Haddara · الأستاذ منذر حداره",
  clockMaster = false,
  seekEpoch = 0,
  seekTo = 0,
  onTime,
  onEnded,
  onError,
  onDuration,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const onTimeRef = useRef(onTime);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onDurationRef = useRef(onDuration);
  const seekingRef = useRef(false);
  const clockMasterRef = useRef(clockMaster);
  onTimeRef.current = onTime;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onDurationRef.current = onDuration;
  clockMasterRef.current = clockMaster;

  const emitTime = (video: HTMLVideoElement, source: VideoClockSource) => {
    if (!clockMasterRef.current) return;
    if (seekingRef.current && source !== "seeked") return;
    onTimeRef.current?.(video.currentTime, source);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const emitEnded = () => onEndedRef.current?.();
    const emitError = () => onErrorRef.current?.();
    const emitMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) onDurationRef.current?.(video.duration);
    };
    const onSeeking = () => {
      seekingRef.current = true;
    };
    const onSeeked = () => {
      seekingRef.current = false;
      emitTime(video, "seeked");
    };
    const onPlay = () => emitTime(video, "play");
    const onPause = () => emitTime(video, "pause");
    const onRate = () => emitTime(video, "ratechange");
    const onTimeUpdate = () => emitTime(video, "timeupdate");

    video.addEventListener("ended", emitEnded);
    video.addEventListener("error", emitError);
    video.addEventListener("loadedmetadata", emitMeta);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ratechange", onRate);
    video.addEventListener("timeupdate", onTimeUpdate);
    if (Number.isFinite(video.duration) && video.duration > 0) emitMeta();
    return () => {
      video.removeEventListener("ended", emitEnded);
      video.removeEventListener("error", emitError);
      video.removeEventListener("loadedmetadata", emitMeta);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ratechange", onRate);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!clockMaster || !videoUrl) return;
    const video = videoRef.current;
    if (!video) return;
    let frame = 0;
    const loop = () => {
      emitTime(video, "raf");
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [clockMaster, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.playbackRate = playbackRate;
    // After a short clip hands the clock to RAF, keep looping so pan/zoom
    // on the canvas does not sit on a frozen last frame (audio stays up).
    video.loop = !clockMaster;
    if (playing) {
      const pastEnd =
        video.ended ||
        (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime >= video.duration - 0.05);
      if (!clockMaster && pastEnd) video.currentTime = 0;
      if (video.paused) void video.play().catch(() => undefined);
    } else if (!video.paused) {
      video.pause();
    }
  }, [playing, playbackRate, videoUrl, clockMaster]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !clockMaster) return;
    if (seekEpoch <= 0) return;
    const duration = Number.isFinite(video.duration) ? video.duration : Number.NaN;
    if (Number.isFinite(duration) && seekTo >= duration - 0.02) {
      seekingRef.current = false;
      return;
    }
    if (Math.abs(video.currentTime - seekTo) <= 0.08) {
      seekingRef.current = false;
      onTimeRef.current?.(video.currentTime, "seeked");
      return;
    }
    seekingRef.current = true;
    video.currentTime = seekTo;
  }, [clockMaster, seekEpoch, seekTo, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || clockMaster) return;
    if (Number.isFinite(video.duration) && video.duration > 0 && currentTime >= video.duration - 0.02) return;
    const drift = Math.abs(video.currentTime - currentTime);
    if (drift > 0.35) video.currentTime = currentTime;
  }, [clockMaster, currentTime, videoUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    const drift = Math.abs(audio.currentTime - currentTime);
    if (drift > 0.35) audio.currentTime = currentTime;
    audio.playbackRate = playbackRate;
    if (playing && audio.paused) void audio.play().catch(() => undefined);
    if (!playing && !audio.paused) audio.pause();
  }, [audioUrl, currentTime, playing, playbackRate]);

  const status = frozen
    ? pickText(STUDIO_UI.boardFreeze, language)
    : speaking
      ? pickText(STUDIO_UI.speaking, language)
      : pickText(STUDIO_UI.paused, language);

  const isLocalDemo = videoUrl === DEMO_AVATAR_VIDEO || videoUrl?.startsWith("/studio/demo-avatar");

  return (
    <section className={`studio-avatar-panel ${speaking ? "speaking" : ""} ${frozen ? "frozen" : ""}`} aria-label={pickText(STUDIO_UI.avatar, language)}>
      <p className="eyebrow">
        {pickText(STUDIO_UI.avatar, language)} · {status}
      </p>
      <div className="studio-avatar-frame">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={poster}
            playsInline
            controls={false}
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
          />
        ) : (
          <img src={poster} alt={teacherName} draggable={false} />
        )}
        <span className="dynamic-watermark">MathMentor · {teacherName}</span>
        {frozen ? <div className="studio-freeze">{pickText(STUDIO_UI.freeze, language)}</div> : null}
        <p className="teacher-nameplate">{teacherName}</p>
      </div>
      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="auto" /> : null}
      <p className="muted studio-demo-hint">
        {videoUrl
          ? isLocalDemo
            ? pickText(STUDIO_UI.demoVideoHint, language)
            : pickText(STUDIO_UI.videoHint, language)
          : pickText(STUDIO_UI.demoHint, language)}
      </p>
    </section>
  );
}
