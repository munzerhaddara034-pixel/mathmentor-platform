"use client";

import "@/styles/lessonPlayer.css";
import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { lessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import { chaptersUrl, subtitleFor, type LessonLang, type LessonManifest } from "@/lib/lessonPlayer/manifest";
import { chapterAt } from "@/lib/lessonPlayer/vtt";
import { ChapterList } from "./ChapterList";
import { PlayerControls } from "./PlayerControls";
import { PlayerHeader } from "./PlayerHeader";
import { PlayerOverlays } from "./PlayerOverlays";
import { PlayerSkeleton } from "./PlayerSkeleton";
import { useChapters } from "./useChapters";
import { useLessonPlayback } from "./useLessonPlayback";
import { usePlayerKeys } from "./usePlayerKeys";
import { useSubtitleCue } from "./useSubtitleCue";

/**
 * Multi-language lesson player: silent master video + synced narration per language (EN / العربية / FR),
 * subtitles that follow the narration, optional chapters. Logic lives in useLessonPlayback / src/lib/lessonPlayer.
 */
export function LessonPlayer({ manifest }: { manifest: LessonManifest }) {
  const { locale, dir } = useI18n();
  const t = useNs(lessonPlayerMessages);
  const playback = useLessonPlayback(manifest, locale);
  const { media, lang, refs } = playback;
  const [subsOn, setSubsOn] = useState(true);
  const subLang = subtitleFor(manifest, lang);
  const cue = useSubtitleCue(refs.videoRef, subLang, subsOn, media.ready);
  const { chapters } = useChapters(chaptersUrl(manifest, lang));
  const currentChapter = chapterAt(chapters, media.time);
  const toggleSubs = () => subLang && setSubsOn((value) => !value);
  const onKeyDown = usePlayerKeys(playback, toggleSubs);
  const langNames: Record<LessonLang, string> = { en: t.langEn, ar: t.langAr, fr: t.langFr };
  const frameClass = `lp-frame${media.ready ? " is-ready" : ""}${media.playing ? " is-playing" : ""}${media.fullscreen ? " is-fullscreen" : ""}`;

  return (
    <section className="lp" dir={dir} aria-label={t.player}>
      <PlayerHeader t={t} aiVoice={manifest.aiVoice} langs={playback.langs} lang={lang} onLang={playback.actions.changeLang} langNames={langNames} ready={media.ready} />
      <div ref={refs.frameRef} className={frameClass} onKeyDown={onKeyDown} tabIndex={0} role="group" aria-label={t.player} aria-describedby="lp-shortcuts">
        <div className="lp-stage">
          <video
            ref={refs.videoRef}
            className="lp-video"
            poster={manifest.poster}
            preload="metadata"
            playsInline
            muted
            disablePictureInPicture
            controlsList="nodownload noplaybackrate"
            onClick={playback.actions.togglePlay}
            onContextMenu={(event) => event.preventDefault()}
          >
            {(Object.entries(manifest.subtitles) as Array<[LessonLang, string]>).map(([code, src]) => (
              <track key={code} kind="subtitles" srcLang={code} src={src} label={langNames[code]} />
            ))}
          </video>
          <audio ref={refs.audioRef} preload="metadata" hidden />
          {!media.ready ? <PlayerSkeleton label={t.loading} poster={manifest.poster} /> : null}
          <PlayerOverlays t={t} media={media} cue={subsOn ? cue : ""} cueLang={subLang} onToggle={playback.actions.togglePlay} />
        </div>
        <PlayerControls t={t} playback={playback} chapters={chapters} currentChapter={currentChapter} hasSubtitles={Boolean(subLang)} subsOn={subsOn} onToggleSubs={toggleSubs} />
      </div>
      <p className="lp-notice" role="status" aria-live="polite">
        {media.notice ? t[media.notice] : ""}
      </p>
      <p id="lp-shortcuts" className="lp-shortcuts">
        {t.shortcuts}
      </p>
      <ChapterList t={t} chapters={chapters} current={currentChapter} ready={media.ready} onSeek={playback.actions.seek} />
    </section>
  );
}
