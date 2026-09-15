"use client";

import { LanguageToggle } from "@/components/LanguageToggle";
import { ClassroomStudio } from "@/components/ClassroomStudio";
import { resolveLessonVideo } from "@/lib/lessonMedia";
import { DEFAULT_LESSON_LANG, type LessonLang } from "@/lib/lessonNotes";
import type { StoryboardScene } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

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
  const currentLang = lang ?? internalLang;
  const setLang = (next: LessonLang) => {
    setInternalLang(next);
    onLangChange?.(next);
  };

  const bilingual = Boolean(videoUrl && videoUrlFr);
  const activeUrl = currentLang === "fr" && videoUrlFr ? videoUrlFr : videoUrl;
  const media = resolveLessonVideo({ videoUrl: activeUrl });
  const activeScenes = currentLang === "fr" && scenesFr?.length ? scenesFr : scenes;

  const videoRef = useRef<HTMLVideoElement>(null);
  const wasPlaying = useRef(false);
  const timeRatio = useRef(0);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || media.kind !== "file") return;
    const apply = () => {
      if (Number.isFinite(node.duration) && node.duration > 0) {
        node.currentTime = Math.min(node.duration * timeRatio.current, Math.max(node.duration - 0.05, 0));
      }
      if (wasPlaying.current) void node.play().catch(() => undefined);
    };
    node.addEventListener("loadedmetadata", apply, { once: true });
    return () => node.removeEventListener("loadedmetadata", apply);
  }, [activeUrl, media.kind]);

  const rememberPosition = () => {
    const node = videoRef.current;
    if (!node || !Number.isFinite(node.duration) || node.duration <= 0) return;
    timeRatio.current = node.currentTime / node.duration;
    wasPlaying.current = !node.paused;
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

  if (media.kind === "storyboard") {
    return (
      <div>
        <div className="lesson-media-toolbar">
          <p className="muted" style={{ margin: 0 }}>
            {currentLang === "fr" ? "Tableau interactif · bascule EN | FR" : "Interactive board · EN | FR toggle"}
          </p>
          {toggle}
        </div>
        <ClassroomStudio heading={heading} scenes={activeScenes} watermark={watermark} lang={currentLang} />
      </div>
    );
  }

  return (
    <div className="classroom video-secure" onContextMenu={(event) => event.preventDefault()}>
      <div className="lesson-media-frame">
        <div className="lang-toggle-overlay">{toggle}</div>
        {media.kind === "file" ? (
          <video
            ref={videoRef}
            key={activeUrl}
            className="lesson-media"
            src={media.src}
            controls
            controlsList="nodownload noplaybackrate"
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
        <span className="dynamic-watermark">{watermark}</span>
        <span className="dynamic-watermark delay">{watermark}</span>
        <p className="classroom-tag">
          {currentLang === "fr" ? "FR · audio + texte" : "EN · audio + text"} · {media.providerLabel} ·{" "}
          {currentLang === "fr" ? "protégé" : "protected"}
        </p>
      </div>
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
