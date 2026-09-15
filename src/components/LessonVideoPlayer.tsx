"use client";

import { LanguageToggle } from "@/components/LanguageToggle";
import { ClassroomStudio } from "@/components/ClassroomStudio";
import { FloatingWatermark } from "@/components/FloatingWatermark";
import { PLAYBACK_SPEEDS, chaptersFromScenes, type PlaybackSpeed } from "@/lib/access";
import { resolveLessonVideo } from "@/lib/lessonMedia";
import { DEFAULT_LESSON_LANG, type LessonLang } from "@/lib/lessonNotes";
import type { StoryboardScene } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

export function LessonVideoPlayer({
  videoUrl,
  videoUrlFr,
  heading,
  scenes,
  scenesFr,
  watermark,
  lang,
  onLangChange,
}: {
  videoUrl?: string;
  videoUrlFr?: string;
  heading: string;
  scenes: StoryboardScene[];
  scenesFr?: StoryboardScene[];
  watermark: string;
  lang?: LessonLang;
  onLangChange?: (lang: LessonLang) => void;
}) {
  const [internalLang, setInternalLang] = useState<LessonLang>(DEFAULT_LESSON_LANG);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const currentLang = lang ?? internalLang;
  const setLang = (next: LessonLang) => {
    setInternalLang(next);
    onLangChange?.(next);
  };

  const bilingual = Boolean(videoUrl && videoUrlFr);
  const activeUrl = currentLang === "fr" && videoUrlFr ? videoUrlFr : videoUrl;
  const media = resolveLessonVideo({ videoUrl: activeUrl });
  const activeScenes = currentLang === "fr" && scenesFr?.length ? scenesFr : scenes;
  const chapters = useMemo(() => chaptersFromScenes(activeScenes), [activeScenes]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wasPlaying = useRef(false);
  const timeRatio = useRef(0);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || media.kind !== "file") return;
    const apply = () => {
      node.playbackRate = speed;
      if (Number.isFinite(node.duration) && node.duration > 0) {
        node.currentTime = Math.min(node.duration * timeRatio.current, Math.max(node.duration - 0.05, 0));
      }
      if (wasPlaying.current) void node.play().catch(() => undefined);
    };
    node.addEventListener("loadedmetadata", apply, { once: true });
    return () => node.removeEventListener("loadedmetadata", apply);
  }, [activeUrl, media.kind, speed]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const rememberPosition = () => {
    const node = videoRef.current;
    if (!node || !Number.isFinite(node.duration) || node.duration <= 0) return;
    timeRatio.current = node.currentTime / node.duration;
    wasPlaying.current = !node.paused;
  };

  const seekChapter = (start: number) => {
    const node = videoRef.current;
    if (!node) return;
    node.currentTime = start;
    void node.play().catch(() => undefined);
  };

  const toggle = (
    <LanguageToggle
      lang={currentLang}
      disabled={!bilingual && media.kind !== "storyboard"}
      onChange={(next) => {
        rememberPosition();
        setLang(next);
      }}
    />
  );

  const speedControl = (
    <label className="speed-control">
      <span>{currentLang === "fr" ? "Vitesse" : "السرعة"}</span>
      <select
        value={speed}
        onChange={(event) => setSpeed(Number(event.target.value) as PlaybackSpeed)}
        aria-label={currentLang === "fr" ? "Vitesse de lecture" : "سرعة التشغيل"}
      >
        {PLAYBACK_SPEEDS.map((value) => (
          <option key={value} value={value}>
            {value}x
          </option>
        ))}
      </select>
    </label>
  );

  if (media.kind === "storyboard") {
    return (
      <div>
        <div className="lesson-media-toolbar">
          <p className="muted" style={{ margin: 0 }}>
            {currentLang === "fr" ? "Tableau interactif · bascule EN | FR" : "Interactive board · EN | FR toggle"}
          </p>
          <div className="player-toolbar-actions">
            {speedControl}
            {toggle}
          </div>
        </div>
        <ClassroomStudio
          heading={heading}
          scenes={activeScenes}
          watermark={watermark}
          lang={currentLang}
          speed={speed}
        />
      </div>
    );
  }

  return (
    <div className="classroom video-secure" onContextMenu={(event) => event.preventDefault()}>
      <div className="lesson-media-frame">
        <div className="lang-toggle-overlay">
          <div className="player-toolbar-actions">
            {speedControl}
            {toggle}
          </div>
        </div>
        {media.kind === "file" ? (
          <video
            ref={videoRef}
            key={activeUrl}
            className="lesson-media"
            src={media.src}
            controls
            controlsList="nodownload"
            disablePictureInPicture
            playsInline
            preload="metadata"
          />
        ) : (
          <iframe
            className="lesson-media"
            title={heading}
            src={media.src}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
        <FloatingWatermark text={watermark} />
        <p className="classroom-tag">
          {currentLang === "fr" ? "FR · audio + texte" : "EN · audio + text"} · {media.providerLabel} ·{" "}
          {currentLang === "fr" ? "protégé" : "protected"}
        </p>
      </div>
      {chapters.length > 1 ? (
        <div className="chapter-rail" dir="ltr">
          <p className="chapter-rail-label">{currentLang === "fr" ? "Chapitres de la leçon" : "فصول الدرس"}</p>
          <div className="chapter-chips">
            {chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                type="button"
                className="chapter-chip"
                onClick={() => (media.kind === "file" ? seekChapter(chapter.start) : undefined)}
                title={`${chapter.title} · ${Math.round(chapter.start)}s`}
              >
                {index + 1}. {chapter.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {bilingual ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {currentLang === "fr"
            ? "Un clic sur FR change la voix et tout ce qui est écrit au tableau."
            : "One click on FR switches the voice and every line written on the board."}
        </p>
      ) : null}
    </div>
  );
}
