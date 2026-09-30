"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LessonPhase, LessonTimeline, CanvasAction } from "@/lib/studio/timeline";
import type { LessonLanguage, LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI, toLessonLocale } from "@/lib/studio/i18n";
import {
  canvasStateAt,
  chaptersForTimeline,
  DEMO_ROLE_STORAGE_KEY,
  segmentAt,
  TEACHER_MODE_STORAGE_KEY,
} from "@/lib/studio/timeline";
import { blockingQuizAt, firstUnresolvedQuiz } from "@/lib/studio/quiz";
import type { VideoClockSource } from "./AvatarPlayer";
import { AvatarPlayer } from "./AvatarPlayer";
import { ChapterScrubBar } from "./ChapterScrubBar";
import { ContentLanguageToggle } from "./ContentLanguageToggle";
import { MathCanvas } from "./MathCanvas";
import { MixedMathText } from "./MixedMathText";
import { PlayerControls } from "./PlayerControls";
import { QuizOverlay } from "./QuizOverlay";
import { TeacherTimelineEditor } from "./TeacherTimelineEditor";
import { useFullscreenHosts, useSavedTimelineEvents, useViewerIdentity } from "./usePlayerRemote";
import { useI18n } from "@/components/i18n/I18nProvider";
import "@/styles/player.css";

function pickVoice(language: LessonLocale) {
  const voices = window.speechSynthesis.getVoices();
  if (language === "fr") {
    return voices.find((voice) => voice.lang.toLowerCase().startsWith("fr"));
  }
  const english = voices.filter((voice) => voice.lang.replace("_", "-").toLowerCase().startsWith("en"));
  return (
    english.find((voice) => /en-US/i.test(voice.lang) && /male|david|mark|guy|ryan|george|andrew|steffan/i.test(voice.name)) ||
    english.find((voice) => /en-US/i.test(voice.lang)) ||
    english[0]
  );
}

function readTeacherUnlock() {
  if (typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  if (query.get("teacher") === "1" || query.get("admin") === "1") return true;
  try {
    if (window.sessionStorage.getItem(TEACHER_MODE_STORAGE_KEY) === "1") return true;
    const role = window.localStorage.getItem(DEMO_ROLE_STORAGE_KEY);
    if (role === "teacher" || role === "admin") return true;
  } catch {
    /* private mode */
  }
  return false;
}

export function InteractiveLessonPlayer({
  timeline: initialTimeline,
  initialLanguage,
  teacherMode: teacherModeProp,
  canTeach = false,
  viewer,
  chromeLanguage,
}: {
  timeline: LessonTimeline;
  /** Content language: voice, board, captions (EN default for the Lebanese Terminale lessons). */
  initialLanguage?: LessonLocale;
  /** Player chrome language. Defaults to the site locale (en default, ar RTL, fr). */
  chromeLanguage?: LessonLanguage;
  teacherMode?: boolean;
  canTeach?: boolean;
  viewer?: { name: string; phone: string };
}) {
  const [timeline, setTimeline] = useState(initialTimeline);
  const { locale } = useI18n();
  const ui: LessonLanguage = chromeLanguage ?? locale;
  const [uiLanguage, setUiLanguage] = useState<LessonLocale>(
    initialLanguage ?? (locale === "fr" ? "fr" : toLessonLocale(initialTimeline.defaultLanguage ?? initialTimeline.language)),
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekEpoch, setSeekEpoch] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoClock, setVideoClock] = useState(Boolean(initialTimeline.media?.videoUrl || initialTimeline.media?.audioUrl));
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [boardFocus, setBoardFocus] = useState(false);
  const [teacherMode, setTeacherMode] = useState(Boolean(teacherModeProp && canTeach));
  const { identity, staffUnlock } = useViewerIdentity(initialTimeline.id, viewer, canTeach);
  const [resolvedQuizzes, setResolvedQuizzes] = useState<string[]>([]);
  const lastTick = useRef<number | null>(null);
  const spokenKey = useRef<string | null>(null);
  const seekingRef = useRef(false);
  const timeRef = useRef(0);
  const videoClockRef = useRef(Boolean(initialTimeline.media?.videoUrl || initialTimeline.media?.audioUrl));
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const videoHostRef = useRef<HTMLDivElement>(null);
  const { fullscreenTarget, toggleFullscreen } = useFullscreenHosts(canvasHostRef, videoHostRef);
  const applySavedEvents = useRef((events: CanvasAction[]) => setTimeline((current) => ({ ...current, events })));
  timeRef.current = currentTime;

  const videoUrl = videoFailed ? undefined : timeline.media?.videoUrl;
  const audioUrl = timeline.media?.audioUrl;
  const hasMediaClock = Boolean(videoUrl || audioUrl);
  const clockMaster = hasMediaClock && videoClock;
  const clockMasterRef = useRef(clockMaster);
  clockMasterRef.current = clockMaster;
  videoClockRef.current = videoClock;

  const segment = segmentAt(timeline, currentTime);
  const canvasClock = Math.round(currentTime * 30) / 30;
  const canvas = useMemo(() => canvasStateAt(timeline, canvasClock), [timeline, canvasClock]);
  const chapters = useMemo(() => chaptersForTimeline(timeline), [timeline]);
  const frozen = Boolean(segment && segment.avatar.state === "paused");
  const speaking = Boolean(playing && segment && segment.avatar.state === "speaking" && !frozen);
  const instructor = timeline.instructor ?? "Prof. Munzer Haddara";
  const blockingQuiz = useMemo(
    () => blockingQuizAt(timeline, currentTime, resolvedQuizzes),
    [timeline, currentTime, resolvedQuizzes],
  );

  useEffect(() => {
    setTimeline(initialTimeline);
    setVideoFailed(false);
    setVideoClock(Boolean(initialTimeline.media?.videoUrl || initialTimeline.media?.audioUrl));
    setVideoDuration(null);
    setResolvedQuizzes([]);
  }, [initialTimeline.id, initialTimeline.media?.videoUrl, initialTimeline.media?.audioUrl]);

  useEffect(() => {
    if (teacherModeProp && (canTeach || staffUnlock)) setTeacherMode(true);
    else if (!canTeach && !staffUnlock) setTeacherMode(false);
    else setTeacherMode(readTeacherUnlock() && (canTeach || staffUnlock));
  }, [teacherModeProp, canTeach, staffUnlock]);

  // After the reset effect above, so saved teacher events win over the initial timeline.
  useSavedTimelineEvents(initialTimeline.id, applySavedEvents);





  useEffect(() => {
    if (!playing || clockMaster) {
      lastTick.current = null;
      return;
    }
    let frame = 0;
    const loop = (now: number) => {
      const prev = lastTick.current ?? now;
      lastTick.current = now;
      const dt = ((now - prev) / 1000) * speed;
      setCurrentTime((time) => {
        const next = time + dt;
        if (next >= timeline.durationSec) {
          setPlaying(false);
          return timeline.durationSec;
        }
        return next;
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, timeline.durationSec, clockMaster]);

  const speakSegment = useCallback(
    (id: string | undefined, language: LessonLocale, text: string) => {
      if (!("speechSynthesis" in window) || !id || videoUrl || audioUrl) return;
      const key = `${id}:${language}`;
      if (spokenKey.current === key) return;
      spokenKey.current = key;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "fr" ? "fr-FR" : "en-US";
      utterance.rate = Math.min(1.4, Math.max(0.7, speed * 0.9));
      const voice = pickVoice(language);
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    },
    [speed, videoUrl, audioUrl],
  );

  useEffect(() => {
    if (videoUrl || audioUrl) return;
    if (!playing || !segment) {
      if (!playing && "speechSynthesis" in window) window.speechSynthesis.cancel();
      if (!playing) spokenKey.current = null;
      return;
    }
    if (frozen) return;
    speakSegment(segment.id, uiLanguage, pickText(segment.narration, uiLanguage));
  }, [frozen, playing, segment, speakSegment, uiLanguage, videoUrl, audioUrl]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const seek = useCallback(
    (time: number, opts?: { fromVideo?: boolean }) => {
      let next = Math.max(0, Math.min(timeline.durationSec, time));
      const gate = firstUnresolvedQuiz(timeline, resolvedQuizzes);
      if (gate && next > gate.at + 0.02) {
        next = gate.at;
        setPlaying(false);
      }
      setCurrentTime((prev) => (opts?.fromVideo && Math.abs(prev - next) < 1 / 30 ? prev : next));
      if (!opts?.fromVideo) {
        spokenKey.current = null;
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        setSeekEpoch((value) => value + 1);
        seekingRef.current = true;
        if (videoUrl || audioUrl) {
          const drive =
            videoDuration != null && Number.isFinite(videoDuration) && videoDuration > 0
              ? next < videoDuration - 0.04
              : next <= 0.5;
          videoClockRef.current = drive;
          clockMasterRef.current = drive;
          setVideoClock(drive);
        }
      }
    },
    [resolvedQuizzes, timeline, videoDuration, videoUrl, audioUrl],
  );

  useEffect(() => {
    if (!blockingQuiz) return;
    if (playing) setPlaying(false);
    if (currentTime > blockingQuiz.at + 0.2) {
      seek(blockingQuiz.at);
    }
  }, [blockingQuiz, currentTime, playing, seek]);

  const changeLanguage = (next: LessonLocale) => {
    setUiLanguage(next);
    spokenKey.current = null;
    if (playing && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const onVideoTime = (time: number, source?: VideoClockSource) => {
    if (!clockMasterRef.current || !videoClockRef.current) return;
    if (seekingRef.current && source !== "seeked") return;
    if (source === "seeked") seekingRef.current = false;
    seek(time, { fromVideo: true });
  };

  const onVideoEnded = () => {
    if (timeRef.current < timeline.durationSec - 0.05 && playing) {
      videoClockRef.current = false;
      clockMasterRef.current = false;
      setVideoClock(false);
      return;
    }
    setPlaying(false);
    setCurrentTime(timeline.durationSec);
  };

  const setTeacherUnlock = (next: boolean) => {
    setTeacherMode(next);
    try {
      if (next) window.sessionStorage.setItem(TEACHER_MODE_STORAGE_KEY, "1");
      else window.sessionStorage.removeItem(TEACHER_MODE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("teacher", "1");
    else url.searchParams.delete("teacher");
    window.history.replaceState({}, "", url);
  };



  const applyEventsLive = (events: CanvasAction[]) => {
    setTimeline((current) => ({ ...current, events }));
    setResolvedQuizzes([]);
  };

  const phaseLabel = (phase: LessonPhase, label?: { en: string; fr?: string; ar?: string }) => {
    if (ui === "ar") return label?.ar ?? pickText(STUDIO_UI.phases[phase], ui);
    return label ? pickText(label, uiLanguage) : pickText(STUDIO_UI.phases[phase], uiLanguage);
  };
  const instructorLabel = ui === "ar" ? "الأستاذ منذر حداره" : instructor;
  const rtl = ui === "ar";

  return (
    <div className="studio-player" dir={rtl ? "rtl" : "ltr"} lang={ui}>
      <header className="studio-head">
        <div>
          <p className="eyebrow">{pickText(STUDIO_UI.eyebrow, ui)}</p>
          <h1 dir="auto" lang={uiLanguage}>
            <MixedMathText text={pickText(timeline.title, uiLanguage)} />
          </h1>
          <p className="muted">
            {instructorLabel}
            {timeline.grade ? (
              <>
                {" · "}
                <bdi dir="ltr">{timeline.grade}</bdi>
              </>
            ) : null}
            {timeline.topic ? (
              <>
                {" · "}
                <bdi dir="ltr">{timeline.topic}</bdi>
              </>
            ) : null}
            {videoUrl && staffUnlock ? ` · ${pickText(STUDIO_UI.syncClock, ui)}` : ""}
          </p>
        </div>
        <div className="studio-head-actions">
          <ContentLanguageToggle value={uiLanguage} uiLanguage={ui} onChange={changeLanguage} />
          <button
            className="btn studio-focus-toggle"
            type="button"
            onClick={() => setBoardFocus((value) => !value)}
          >
            {boardFocus ? pickText(STUDIO_UI.focusVideo, ui) : pickText(STUDIO_UI.focusBoard, ui)}
          </button>
          <button className="btn" type="button" onClick={() => toggleFullscreen("board")}>
            {fullscreenTarget === "board" ? pickText(STUDIO_UI.exitFullscreen, ui) : pickText(STUDIO_UI.fullscreenBoard, ui)}
          </button>
          <button className="btn" type="button" onClick={() => toggleFullscreen("video")}>
            {fullscreenTarget === "video" ? pickText(STUDIO_UI.exitFullscreen, ui) : pickText(STUDIO_UI.fullscreenVideo, ui)}
          </button>
          {staffUnlock ? (
            <button className="btn" type="button" onClick={() => setTeacherUnlock(!teacherMode)}>
              {teacherMode ? pickText(STUDIO_UI.teacherLock, ui) : pickText(STUDIO_UI.teacherUnlock, ui)}
            </button>
          ) : null}
        </div>
      </header>

      <div className="studio-phases">
        {timeline.segments.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`phase-chip ${segment?.id === item.id ? "active" : ""}`}
            onClick={() => {
              const first = item.canvas.actions.find((action) => action.type !== "clear");
              seek(item.start + (first?.at ?? 0.5) + 0.08);
            }}
          >
            {phaseLabel(item.phase, item.label)}
          </button>
        ))}
      </div>

      <div className={`studio-split ${boardFocus ? "board-focus" : ""}`} dir="ltr" lang={uiLanguage}>
        <div ref={canvasHostRef} className="studio-fs-host studio-canvas-host">
          <MathCanvas
            state={canvas}
            language={uiLanguage}
            uiLanguage={ui}
            currentTime={canvasClock}
            watermarkName={identity.name}
            watermarkPhone={identity.phone}
          />
        </div>
        <div ref={videoHostRef} className="studio-fs-host studio-avatar-column">
          <AvatarPlayer
            language={uiLanguage}
            uiLanguage={ui}
            showHints={staffUnlock}
            speaking={speaking}
            frozen={frozen}
            playing={playing && !blockingQuiz}
            currentTime={currentTime}
            playbackRate={speed}
            videoUrl={videoUrl}
            audioUrl={timeline.media?.audioUrl}
            poster={timeline.media?.poster ?? "/teachers/munzer.jpg?v=4"}
            teacherName={instructorLabel}
            watermarkName={identity.name}
            watermarkPhone={identity.phone}
            clockMaster={clockMaster}
            seekEpoch={seekEpoch}
            seekTo={currentTime}
            onTime={onVideoTime}
            onEnded={onVideoEnded}
            onError={() => {
              setVideoFailed(true);
              if (!audioUrl) {
                videoClockRef.current = false;
                clockMasterRef.current = false;
                setVideoClock(false);
              }
            }}
            onDuration={(duration) => {
              setVideoDuration(duration);
              const drive = timeRef.current < duration - 0.04;
              videoClockRef.current = drive;
              clockMasterRef.current = Boolean(videoUrl || audioUrl) && drive;
              setVideoClock(drive);
            }}
          />
          <ChapterScrubBar
            chapters={chapters}
            durationSec={timeline.durationSec}
            currentTime={currentTime}
            language={uiLanguage}
            uiLanguage={ui}
            onSeek={seek}
          />
        </div>
      </div>

      {blockingQuiz ? (
        <QuizOverlay
          key={blockingQuiz.id}
          quiz={blockingQuiz}
          language={uiLanguage}
          uiLanguage={ui}
          onResolved={() => {
            setResolvedQuizzes((ids) => (ids.includes(blockingQuiz.id) ? ids : [...ids, blockingQuiz.id]));
            setPlaying(true);
          }}
        />
      ) : null}

      <div className="studio-caption" aria-live="polite" dir="ltr" lang={uiLanguage}>
        <p>{segment ? <MixedMathText text={pickText(segment.narration, uiLanguage)} /> : ""}</p>
      </div>

      <PlayerControls
        ui={ui}
        playing={playing}
        currentTime={currentTime}
        durationSec={timeline.durationSec}
        speed={speed}
        onPlayPause={() => {
          if (blockingQuiz) return;
          if (currentTime >= timeline.durationSec) {
            seek(0);
            setPlaying(true);
            return;
          }
          setPlaying((value) => !value);
        }}
        onRestart={() => {
          setPlaying(false);
          setResolvedQuizzes([]);
          seek(0);
        }}
        onSpeed={setSpeed}
        onSeek={seek}
      />

      {teacherMode ? (
        <TeacherTimelineEditor
          key={timeline.id}
          timeline={timeline}
          language={uiLanguage}
          onApply={applyEventsLive}
        />
      ) : null}
    </div>
  );
}
