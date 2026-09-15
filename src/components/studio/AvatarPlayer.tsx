"use client";

import { useEffect, useRef } from "react";
import type { LessonLanguage } from "@/lib/studio/timeline";

type Props = {
  language: LessonLanguage;
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
  teacherName = "Prof. Munzer Haddara · الأستاذ منذر حدارة",
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

  return (
    <section
      className={`studio-avatar-panel ${speaking ? "speaking" : ""} ${frozen ? "frozen" : ""}`}
      aria-label={language === "ar" ? "مشغّل صورة الأستاذ" : "Teacher avatar player"}
    >
      <p className="eyebrow">
        {language === "ar" ? "مشغّل الدروس الشارحة" : "AI avatar player"} · {frozen ? (language === "ar" ? "تجميد الرسم" : "board freeze") : speaking ? (language === "ar" ? "يشرح" : "speaking") : language === "ar" ? "إيقاف" : "paused"}
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
        {frozen ? (
          <div className="studio-freeze">
            {language === "ar" ? "انظر إلى السبورة" : "Look at the board"}
          </div>
        ) : null}
        <p className="teacher-nameplate">{teacherName}</p>
      </div>
      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="auto" /> : null}
      <p className="muted studio-demo-hint">
        {videoUrl
          ? language === "ar"
            ? "فيديو هيغن / ملف محلي."
            : "HeyGen or local video."
          : language === "ar"
            ? "وضع تجريبي: صورة الأستاذ منذر + خط زمني صامت (أو صوت HTML5 إن وُجد). لا يُستدعى HeyGen بدون مفتاح."
            : "Demo mode: Professor Munzer still + silent timeline (or HTML5 audio if provided). HeyGen is not called without a key."}
      </p>
    </section>
  );
}
