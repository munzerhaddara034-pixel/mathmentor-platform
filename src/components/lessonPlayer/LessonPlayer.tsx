"use client";

import "@/styles/lessonPlayer.css";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { lessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import { formatClock, keyAction } from "@/lib/lessonPlayer/format";
import {
  audioLanguages,
  availableRenditions,
  chaptersUrl,
  initialLanguage,
  playbackPlan,
  subtitleFor,
  type LessonLang,
  type LessonManifest,
  type Rendition,
} from "@/lib/lessonPlayer/manifest";
import { pickRendition, type ConnectionHint } from "@/lib/lessonPlayer/rendition";
import { AudioVideoSync } from "@/lib/lessonPlayer/sync";
import { chapterAt, parseVtt, type VttCue } from "@/lib/lessonPlayer/vtt";
import { Icon } from "./icons";
import { LangPill } from "./LangPill";
import { PlayerSkeleton } from "./PlayerSkeleton";
import { SettingsMenu, type QualityChoice } from "./SettingsMenu";

type Notice = "audioError" | "audioBlocked" | "videoError" | "noAudio";

function readConnection(): ConnectionHint | null {
  const nav = navigator as Navigator & { connection?: ConnectionHint };
  return nav.connection ?? null;
}

function cueText(track: TextTrack | null): string {
  const cues = track?.activeCues;
  if (!cues) return "";
  const lines: string[] = [];
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i] as TextTrackCue & { text?: string };
    if (cue.text) lines.push(cue.text.replace(/<[^>]+>/g, ""));
  }
  return lines.join("\n");
}

export function LessonPlayer({ manifest }: { manifest: LessonManifest }) {
  const { locale, dir, m } = useI18n();
  const t = useNs(lessonPlayerMessages);
  const langs = useMemo(() => audioLanguages(manifest), [manifest]);
  const renditions = useMemo(() => availableRenditions(manifest), [manifest]);
  const langNames: Record<LessonLang, string> = { en: t.langEn, ar: t.langAr, fr: t.langFr };

  const [lang, setLang] = useState<LessonLang>(() => initialLanguage(manifest, locale));
  const subLang = subtitleFor(manifest, lang);
  const [subsOn, setSubsOn] = useState(true);
  const [quality, setQuality] = useState<QualityChoice>("auto");
  const [autoRendition, setAutoRendition] = useState<Rendition | null>(null);
  const activeRendition: Rendition | null = quality === "auto" ? autoRendition : quality;

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(manifest.duration);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [holding, setHolding] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [videoWaiting, setVideoWaiting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cue, setCue] = useState("");
  const [chapters, setChapters] = useState<VttCue[]>([]);
  const [fullscreen, setFullscreen] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const syncRef = useRef<AudioVideoSync | null>(null);
  const videoSrcRef = useRef<string | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  const plan = playbackPlan(manifest, lang);
  const muxed = plan.mode === "muxed";

  /** Point video + audio at the sources for `nextLang` / `rendition`, keeping position and play state. */
  const applyPlan = useCallback(
    async (nextLang: LessonLang, rendition: Rendition | null) => {
      const sync = syncRef.current;
      if (!sync) return;
      const next = playbackPlan(manifest, nextLang);
      const master = rendition ? manifest.video[rendition] : undefined;
      const targetVideo = next.mode === "muxed" ? next.src : master;
      if (next.mode === "synced") {
        if (targetVideo && videoSrcRef.current !== targetVideo) {
          videoSrcRef.current = targetVideo;
          await sync.setVideoSource(targetVideo);
        }
        if (langRef.current === nextLang) await sync.setAudioSource(next.audio);
      } else {
        await sync.setAudioSource(null);
        if (targetVideo && videoSrcRef.current !== targetVideo) {
          videoSrcRef.current = targetVideo;
          await sync.setVideoSource(targetVideo);
        }
      }
      if (langRef.current === nextLang) setNotice(next.mode === "silent" ? "noAudio" : null);
    },
    [manifest],
  );

  // Mount: controller + UI listeners + first source selection (preload="metadata" only).
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    const sync = new AudioVideoSync(video, audio, {
      onHold: setHolding,
      onSwitching: setSwitching,
      onAudioError: () => setNotice("audioError"),
      onAudioBlocked: () => setNotice("audioBlocked"),
    });
    syncRef.current = sync;

    const updateBuffered = () => {
      const ranges = video.buffered;
      setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
    };
    const handlers: Array<[string, () => void]> = [
      [
        "loadedmetadata",
        () => {
          setReady(true);
          if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
        },
      ],
      ["timeupdate", () => setTime(video.currentTime)],
      ["seeked", () => setTime(video.currentTime)],
      ["progress", updateBuffered],
      ["play", () => { setPlaying(sync.state.intent); setEnded(false); }],
      ["playing", () => { setPlaying(sync.state.intent); setVideoWaiting(false); }],
      ["pause", () => setPlaying(sync.state.intent)],
      ["waiting", () => setVideoWaiting(true)],
      ["canplay", () => setVideoWaiting(false)],
      ["ended", () => { setEnded(true); setPlaying(false); }],
      ["ratechange", () => setRate(video.playbackRate)],
      ["error", () => video.error && setNotice("videoError")],
    ];
    for (const [type, fn] of handlers) video.addEventListener(type, fn);

    const width = frameRef.current?.getBoundingClientRect().width || window.innerWidth;
    const auto = pickRendition({ width, devicePixelRatio: window.devicePixelRatio, connection: readConnection(), available: renditions });
    setAutoRendition(auto);
    void applyPlan(langRef.current, auto);

    const onFullscreen = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      for (const [type, fn] of handlers) video.removeEventListener(type, fn);
      document.removeEventListener("fullscreenchange", onFullscreen);
      sync.destroy();
      syncRef.current = null;
      videoSrcRef.current = null;
    };
  }, [applyPlan, renditions]);

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

  // Subtitles: the active track is "hidden" (cues fire, we render them), every other track "disabled".
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active: TextTrack | null = null;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i];
      if (track.kind !== "subtitles") continue;
      const on = subsOn && track.language === subLang;
      track.mode = on ? "hidden" : "disabled";
      if (on) active = track;
    }
    if (!active) {
      setCue("");
      return;
    }
    const track = active;
    const onCue = () => setCue(cueText(track));
    onCue();
    track.addEventListener("cuechange", onCue);
    return () => track.removeEventListener("cuechange", onCue);
  }, [subsOn, subLang, ready]);

  // Chapters (optional chapters.vtt): markers on the timeline + list under the player.
  useEffect(() => {
    const url = chaptersUrl(manifest, lang);
    if (!url) {
      setChapters([]);
      return;
    }
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.text() : ""))
      .then((text) => setChapters(parseVtt(text).filter((c) => c.text)))
      .catch(() => {
        if (!controller.signal.aborted) setChapters([]);
      });
    return () => controller.abort();
  }, [manifest, lang]);

  const changeLang = (next: LessonLang) => {
    if (next === lang) return;
    setLang(next);
    langRef.current = next;
    setNotice(null);
    void applyPlan(next, activeRendition);
  };

  const changeQuality = (choice: QualityChoice) => {
    setQuality(choice);
    const rendition = choice === "auto" ? autoRendition : choice;
    const src = rendition ? manifest.video[rendition] : undefined;
    const sync = syncRef.current;
    if (!sync || !src || muxed || videoSrcRef.current === src) return;
    videoSrcRef.current = src;
    void sync.setVideoSource(src);
  };

  const togglePlay = () => {
    const sync = syncRef.current;
    if (!sync) return;
    if (notice === "audioBlocked") setNotice(null);
    if (sync.state.intent) {
      sync.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
      void sync.play().then(() => setPlaying(sync.state.intent));
    }
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (video) syncRef.current?.seek(video.currentTime + seconds);
  };

  const toggleFullscreen = () => {
    const frame = frameRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!frame) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else if (frame.requestFullscreen) void frame.requestFullscreen().catch(() => undefined);
    else video?.webkitEnterFullscreen?.();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.closest(".lp-menu, .lp-pill")) return;
    if ((event.key === " " || event.key === "Enter") && target.tagName === "BUTTON") return;
    const onSlider = target instanceof HTMLInputElement && target.type === "range";
    const action = keyAction(event.key, { onSlider });
    if (!action) return;
    event.preventDefault();
    switch (action.type) {
      case "toggle":
        togglePlay();
        break;
      case "seekBy":
        seekBy(action.seconds);
        break;
      case "seekTo":
        syncRef.current?.seek(action.fraction * (duration || 0));
        break;
      case "volumeBy":
        setVolume((v) => Math.min(1, Math.max(0, Math.round((v + action.delta) * 10) / 10)));
        setMuted(false);
        break;
      case "mute":
        setMuted((v) => !v);
        break;
      case "subtitles":
        if (subLang) setSubsOn((v) => !v);
        break;
      case "fullscreen":
        toggleFullscreen();
        break;
    }
  };

  const total = duration || 0;
  const progress = total ? Math.min(100, (time / total) * 100) : 0;
  const bufferedPct = total ? Math.min(100, (buffered / total) * 100) : 0;
  const currentChapter = chapterAt(chapters, time);
  const status = !ready ? "" : switching ? t.switching : holding ? t.buffering : videoWaiting && playing ? t.loading : "";
  const noticeText = notice ? t[notice] : "";
  const brandText = m.brand.aria;
  const showBigPlay = ready && !playing && !switching;

  return (
    <section className="lp" dir={dir} aria-label={t.player}>
      <header className="lp-head">
        <div className="lp-id">
          <span className="lp-brand" lang={locale === "ar" ? "ar" : undefined}>
            {brandText}
          </span>
          <span className="lp-presenter" aria-label={`${t.presenter}: ${m.persona.label}`}>
            <span className="lp-avatar" aria-hidden="true">
              {locale === "ar" ? "م" : "M"}
            </span>
            <span className="lp-presenter-name">{m.persona.name}</span>
            <span className="lp-badge lp-badge-ai" aria-hidden="true">
              {m.persona.ai}
            </span>
            {manifest.aiVoice ? (
              <span className="lp-badge lp-badge-voice" aria-hidden="true">
                {t.aiVoice}
              </span>
            ) : null}
          </span>
          {manifest.aiVoice ? <span className="lp-sr">{t.aiVoice}</span> : null}
        </div>
        {langs.length > 1 ? (
          <LangPill langs={langs} value={lang} onChange={changeLang} label={t.audioLanguage} names={langNames} disabled={!ready} />
        ) : langs.length === 1 ? (
          <span className="lp-pill lp-pill-single" lang={langs[0]}>
            {langNames[langs[0]]}
          </span>
        ) : null}
      </header>

      <div
        ref={frameRef}
        className={`lp-frame${ready ? " is-ready" : ""}${playing ? " is-playing" : ""}${fullscreen ? " is-fullscreen" : ""}`}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label={t.player}
        aria-describedby="lp-shortcuts"
      >
        <div className="lp-stage">
        <video
          ref={videoRef}
          className="lp-video"
          poster={manifest.poster}
          preload="metadata"
          playsInline
          muted
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          onClick={togglePlay}
          onContextMenu={(event) => event.preventDefault()}
        >
          {(Object.entries(manifest.subtitles) as Array<[LessonLang, string]>).map(([code, src]) => (
            <track key={code} kind="subtitles" srcLang={code} src={src} label={langNames[code]} />
          ))}
        </video>
        <audio ref={audioRef} preload="metadata" hidden />

        {!ready ? <PlayerSkeleton label={t.loading} poster={manifest.poster} /> : null}

        {subsOn && cue ? (
          <div className="lp-cue" lang={subLang ?? undefined} dir={subLang === "ar" ? "rtl" : "ltr"}>
            <span>{cue}</span>
          </div>
        ) : null}

        {status ? (
          <div className="lp-status" role="status">
            <span className="lp-spinner" aria-hidden="true" />
            {status}
          </div>
        ) : null}

        {showBigPlay ? (
          <button type="button" className="lp-bigplay" aria-label={ended ? t.replay : t.play} onClick={togglePlay}>
            <Icon name={ended ? "replay" : "play"} />
          </button>
        ) : null}

        </div>

        <div className="lp-controls">
          <div className="lp-timeline" dir="ltr">
            <div className="lp-track" aria-hidden="true">
              <span className="lp-buffered" style={{ width: `${bufferedPct}%` }} />
              <span className="lp-played" style={{ width: `${progress}%` }} />
              {total
                ? chapters.map((chapter, i) =>
                    i === 0 ? null : <span key={chapter.start} className="lp-tick" style={{ left: `${(chapter.start / total) * 100}%` }} />,
                  )
                : null}
            </div>
            <input
              className="lp-seek"
              type="range"
              min={0}
              max={total || 0}
              step={0.1}
              value={Math.min(time, total || 0)}
              disabled={!ready}
              aria-label={t.seek}
              aria-valuetext={fmt(t.seekValue, { current: formatClock(time), total: formatClock(total) })}
              onChange={(event) => syncRef.current?.seek(Number(event.target.value))}
            />
          </div>
          <div className="lp-bar">
            <button type="button" className="lp-btn" onClick={togglePlay} disabled={!ready} aria-label={playing ? t.pause : ended ? t.replay : t.play}>
              <Icon name={playing ? "pause" : ended ? "replay" : "play"} />
            </button>
            <button type="button" className="lp-btn lp-hide-xs" onClick={() => seekBy(-10)} disabled={!ready} aria-label={fmt(t.back, { s: 10 })}>
              <Icon name="back" />
            </button>
            <button type="button" className="lp-btn lp-hide-xs" onClick={() => seekBy(10)} disabled={!ready} aria-label={fmt(t.forward, { s: 10 })}>
              <Icon name="forward" />
            </button>
            <span className="lp-time">
              <bdi dir="ltr">
                {formatClock(time)} / {formatClock(total)}
              </bdi>
            </span>
            {currentChapter >= 0 && chapters[currentChapter] ? (
              <span className="lp-chapter-now lp-hide-sm" dir="auto">
                {chapters[currentChapter].text}
              </span>
            ) : null}
            <span className="lp-spacer" />
            <button
              type="button"
              className="lp-btn"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? t.unmute : t.mute}
              aria-pressed={muted}
            >
              <Icon name={muted || volume === 0 ? "muted" : "volume"} />
            </button>
            <input
              className="lp-volume lp-hide-sm"
              type="range"
              min={0}
              max={1}
              step={0.05}
              dir="ltr"
              value={muted ? 0 : volume}
              aria-label={t.volume}
              aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
              onChange={(event) => {
                setVolume(Number(event.target.value));
                setMuted(false);
              }}
            />
            {subLang ? (
              <button
                type="button"
                className={`lp-btn${subsOn ? " on" : ""}`}
                onClick={() => setSubsOn((v) => !v)}
                aria-label={subsOn ? t.subtitlesOff : t.subtitlesOn}
                aria-pressed={subsOn}
              >
                <Icon name="cc" />
              </button>
            ) : null}
            <SettingsMenu
              renditions={muxed ? [] : renditions}
              quality={quality}
              activeRendition={muxed ? null : activeRendition}
              onQuality={changeQuality}
              rate={rate}
              onRate={(next) => syncRef.current?.setRate(next)}
              labels={{ quality: t.quality, qualityAuto: t.qualityAuto, speed: t.speed, settings: t.settings }}
            />
            <button type="button" className="lp-btn" onClick={toggleFullscreen} aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}>
              <Icon name={fullscreen ? "exitFullscreen" : "fullscreen"} />
            </button>
          </div>
        </div>
      </div>

      <p className="lp-notice" role="status" aria-live="polite">
        {noticeText}
      </p>
      <p id="lp-shortcuts" className="lp-shortcuts">
        {t.shortcuts}
      </p>

      {chapters.length ? (
        <nav className="lp-chapters" aria-label={t.chapters}>
          <h2 className="lp-chapters-title">{t.chapters}</h2>
          <ol>
            {chapters.map((chapter, i) => (
              <li key={`${chapter.start}-${i}`}>
                <button
                  type="button"
                  aria-current={i === currentChapter ? "step" : undefined}
                  onClick={() => syncRef.current?.seek(chapter.start)}
                  disabled={!ready}
                >
                  <bdi dir="ltr" className="lp-chapter-time">
                    {formatClock(chapter.start)}
                  </bdi>
                  <span dir="auto">{chapter.text || fmt(t.chapter, { n: i + 1 })}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </section>
  );
}
