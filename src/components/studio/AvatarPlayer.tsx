"use client";

import { useEffect, useRef } from "react";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";

type Props = {
  language: LessonLocale;
  speaking: boolean;
  frozen: boolean;
  playing: boolean;
  currentTime: number;
  videoUrl?: string;
  audioUrl?: string;
  poster?: string;
  teacherName?: string;
};

const DEFAULT_POSTER = "/teachers/munzer.jpg?v=4";

export function AvatarPlayer({
  language,
  speaking,
  frozen,
  playing,
  currentTime,
  videoUrl,
  audioUrl,
  poster = DEFAULT_POSTER,
  teacherName = "Prof. Munzer Al-Tarah · الأستاذ منذر حدارة",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    const drift = Math.abs(video.currentTime - currentTime);
    if (drift > 0.35) video.currentTime = currentTime;
    if (playing && video.paused) void video.play().catch(() => undefined);
    if (!playing && !video.paused) video.pause();
  }, [currentTime, playing, videoUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    const drift = Math.abs(audio.currentTime - currentTime);
    if (drift > 0.35) audio.currentTime = currentTime;
    if (playing && audio.paused) void audio.play().catch(() => undefined);
    if (!playing && !audio.paused) audio.pause();
  }, [audioUrl, currentTime, playing]);

  const status = frozen
    ? pickText(STUDIO_UI.boardFreeze, language)
    : speaking
      ? pickText(STUDIO_UI.speaking, language)
      : pickText(STUDIO_UI.paused, language);

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
      <p className="muted studio-demo-hint">{videoUrl ? pickText(STUDIO_UI.videoHint, language) : pickText(STUDIO_UI.demoHint, language)}</p>
    </section>
  );
}
