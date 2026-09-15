"use client";

import { useEffect, useRef } from "react";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";

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
  /** When true, this panel is the clock: timeupdate drives the canvas. */
  clockMaster?: boolean;
  seekEpoch?: number;
  seekTo?: number;
  onTime?: (time: number) => void;
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
  teacherName = "Prof. Munzer Al-Tarah · الأستاذ منذر حدارة",
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
  onTimeRef.current = onTime;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onDurationRef.current = onDuration;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const emitEnded = () => onEndedRef.current?.();
    const emitError = () => onErrorRef.current?.();
    const emitMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) onDurationRef.current?.(video.duration);
    };

    video.addEventListener("ended", emitEnded);
    video.addEventListener("error", emitError);
    video.addEventListener("loadedmetadata", emitMeta);
    return () => {
      video.removeEventListener("ended", emitEnded);
      video.removeEventListener("error", emitError);
      video.removeEventListener("loadedmetadata", emitMeta);
    };
  }, [videoUrl]);

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
    if (Math.abs(video.currentTime - seekTo) > 0.12) video.currentTime = seekTo;
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
            onTimeUpdate={(event) => {
              if (!clockMaster) return;
              onTimeRef.current?.(event.currentTarget.currentTime);
            }}
            onSeeked={(event) => {
              if (!clockMaster) return;
              onTimeRef.current?.(event.currentTarget.currentTime);
            }}
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
