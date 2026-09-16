"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LessonPhase, LessonTimeline, CanvasAction } from "@/lib/studio/timeline";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI, toLessonLocale } from "@/lib/studio/i18n";
import {
  canvasStateAt,
  DEMO_ROLE_STORAGE_KEY,
  eventsStorageKey,
  formatClock,
  segmentAt,
  TEACHER_MODE_STORAGE_KEY,
  validateTimelineEvents,
} from "@/lib/studio/timeline";
import { blockingQuizAt, firstUnresolvedQuiz } from "@/lib/studio/quiz";
import type { VideoClockSource } from "./AvatarPlayer";
import { AvatarPlayer } from "./AvatarPlayer";
import { MathCanvas } from "./MathCanvas";
import { QuizOverlay } from "./QuizOverlay";
import { TeacherTimelineEditor } from "./TeacherTimelineEditor";

const SPEEDS = [0.75, 1, 1.25, 1.5];

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
}: {
  timeline: LessonTimeline;
  initialLanguage?: LessonLocale;
  teacherMode?: boolean;
}) {
  const [timeline, setTimeline] = useState(initialTimeline);
  const [uiLanguage, setUiLanguage] = useState<LessonLocale>(
    initialLanguage ?? toLessonLocale(initialTimeline.defaultLanguage ?? initialTimeline.language),
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekEpoch, setSeekEpoch] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoClock, setVideoClock] = useState(Boolean(initialTimeline.media?.videoUrl));
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [boardFocus, setBoardFocus] = useState(false);
  const [teacherMode, setTeacherMode] = useState(Boolean(teacherModeProp));
  const [resolvedQuizzes, setResolvedQuizzes] = useState<string[]>([]);
  const lastTick = useRef<number | null>(null);
  const spokenKey = useRef<string | null>(null);
  const seekingRef = useRef(false);
  const timeRef = useRef(0);
  const videoClockRef = useRef(Boolean(initialTimeline.media?.videoUrl));
  timeRef.current = currentTime;

  const videoUrl = videoFailed ? undefined : timeline.media?.videoUrl;
  const clockMaster = Boolean(videoUrl) && videoClock;
  const clockMasterRef = useRef(clockMaster);
  clockMasterRef.current = clockMaster;
  videoClockRef.current = videoClock;

  const segment = segmentAt(timeline, currentTime);
  const canvas = useMemo(() => canvasStateAt(timeline, currentTime), [timeline, currentTime]);
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
    setVideoClock(Boolean(initialTimeline.media?.videoUrl));
    setVideoDuration(null);
    setResolvedQuizzes([]);
  }, [initialTimeline.id, initialTimeline.media?.videoUrl]);

  useEffect(() => {
    if (teacherModeProp) setTeacherMode(true);
    else setTeacherMode(readTeacherUnlock());
  }, [teacherModeProp]);

  useEffect(() => {
    let cancelled = false;
    const applyEvents = (events: CanvasAction[]) => {
      if (cancelled) return;
      setTimeline((current) => ({ ...current, events }));
    };
    try {
      const raw = window.sessionStorage.getItem(eventsStorageKey(initialTimeline.id));
      if (raw) {
        const parsed = validateTimelineEvents(JSON.parse(raw) as unknown);
        if (parsed.ok) {
          applyEvents(parsed.events);
          return () => {
            cancelled = true;
          };
        }
      }
    } catch {
      /* ignore */
    }
    void fetch(`/api/studio/events?lessonId=${encodeURIComponent(initialTimeline.id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { events?: unknown; saved?: boolean } | null) => {
        if (!payload?.saved || !payload.events) return;
        const parsed = validateTimelineEvents(payload.events);
        if (parsed.ok) applyEvents(parsed.events);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialTimeline.id]);

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
      if (!("speechSynthesis" in window) || !id || videoUrl) return;
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
    [speed, videoUrl],
  );

  useEffect(() => {
    if (videoUrl) return;
    if (!playing || !segment) {
      if (!playing && "speechSynthesis" in window) window.speechSynthesis.cancel();
      if (!playing) spokenKey.current = null;
      return;
    }
    if (frozen) return;
    speakSegment(segment.id, uiLanguage, pickText(segment.narration, uiLanguage));
  }, [frozen, playing, segment, speakSegment, uiLanguage, videoUrl]);

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
      setCurrentTime((prev) => (opts?.fromVideo && Math.abs(prev - next) < 1 / 90 ? prev : next));
      if (!opts?.fromVideo) {
        spokenKey.current = null;
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        setSeekEpoch((value) => value + 1);
        seekingRef.current = true;
        if (videoUrl) {
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
    [resolvedQuizzes, timeline, videoDuration, videoUrl],
  );

  useEffect(() => {
    if (!blockingQuiz) return;
    if (playing) setPlaying(false);
    if (currentTime > blockingQuiz.at + 0.2) {
      seek(blockingQuiz.at);
    }
  }, [blockingQuiz, currentTime, playing, seek]);

  const toggleLanguage = () => {
    setUiLanguage((current) => (current === "en" ? "fr" : "en"));
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

  const progressPct = (currentTime / timeline.durationSec) * 100;
  const phaseLabel = (phase: LessonPhase, label?: { en: string; fr?: string }) =>
    label ? pickText(label, uiLanguage) : pickText(STUDIO_UI.phases[phase], uiLanguage);

  return (
    <div className="studio-player" dir="ltr" lang={uiLanguage}>
      <header className="studio-head">
        <div>
          <p className="eyebrow">{pickText(STUDIO_UI.eyebrow, uiLanguage)}</p>
          <h1>{pickText(timeline.title, uiLanguage)}</h1>
          <p className="muted">
            {instructor}
            {timeline.grade ? ` · ${timeline.grade}` : ""}
            {timeline.topic ? ` · ${timeline.topic}` : ""}
            {videoUrl ? ` · ${pickText(STUDIO_UI.syncClock, uiLanguage)}` : ""}
          </p>
        </div>
        <div className="studio-head-actions">
          <button
            className="btn studio-focus-toggle"
            type="button"
            onClick={() => setBoardFocus((value) => !value)}
          >
            {boardFocus ? pickText(STUDIO_UI.focusVideo, uiLanguage) : pickText(STUDIO_UI.focusBoard, uiLanguage)}
          </button>
          <button className="btn" type="button" onClick={() => setTeacherUnlock(!teacherMode)}>
            {teacherMode ? pickText(STUDIO_UI.teacherLock, uiLanguage) : pickText(STUDIO_UI.teacherUnlock, uiLanguage)}
          </button>
          <button className="btn dark studio-lang-toggle" type="button" onClick={toggleLanguage}>
            {uiLanguage === "en" ? STUDIO_UI.switchToFrench : STUDIO_UI.switchToEnglish}
          </button>
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

      <div className={`studio-split ${boardFocus ? "board-focus" : ""}`}>
        <MathCanvas state={canvas} language={uiLanguage} currentTime={currentTime} />
        <AvatarPlayer
          language={uiLanguage}
          speaking={speaking}
          frozen={frozen}
          playing={playing && !blockingQuiz}
          currentTime={currentTime}
          playbackRate={speed}
          videoUrl={videoUrl}
          audioUrl={timeline.media?.audioUrl}
          poster={timeline.media?.poster ?? "/teachers/munzer.jpg?v=4"}
          teacherName={instructor}
          clockMaster={clockMaster}
          seekEpoch={seekEpoch}
          seekTo={currentTime}
          onTime={onVideoTime}
          onEnded={onVideoEnded}
          onError={() => {
            setVideoFailed(true);
            videoClockRef.current = false;
            clockMasterRef.current = false;
            setVideoClock(false);
          }}
          onDuration={(duration) => {
            setVideoDuration(duration);
            const drive = timeRef.current < duration - 0.04;
            videoClockRef.current = drive;
            clockMasterRef.current = Boolean(videoUrl) && drive;
            setVideoClock(drive);
          }}
        />
      </div>

      {blockingQuiz ? (
        <QuizOverlay
          quiz={blockingQuiz}
          language={uiLanguage}
          onResolved={() => {
            setResolvedQuizzes((ids) => (ids.includes(blockingQuiz.id) ? ids : [...ids, blockingQuiz.id]));
            setPlaying(true);
          }}
        />
      ) : null}

      <div className="studio-caption" aria-live="polite">
        <p>{segment ? pickText(segment.narration, uiLanguage) : ""}</p>
      </div>

      <div className="studio-controls">
        <button
          className="btn dark"
          type="button"
          onClick={() => {
            if (blockingQuiz) return;
            if (currentTime >= timeline.durationSec) {
              seek(0);
              setPlaying(true);
              return;
            }
            setPlaying((value) => !value);
          }}
        >
          {playing ? pickText(STUDIO_UI.pause, uiLanguage) : pickText(STUDIO_UI.play, uiLanguage)}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setPlaying(false);
            setResolvedQuizzes([]);
            seek(0);
          }}
        >
          {pickText(STUDIO_UI.restart, uiLanguage)}
        </button>
        <label className="studio-speed">
          {pickText(STUDIO_UI.speed, uiLanguage)}
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          {formatClock(currentTime)} / {formatClock(timeline.durationSec)}
        </span>
        <input
          className="studio-seek"
          type="range"
          min={0}
          max={timeline.durationSec}
          step={0.1}
          value={currentTime}
          aria-label={pickText(STUDIO_UI.seek, uiLanguage)}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </div>
      <div className="progress-track" aria-hidden>
        <span style={{ width: `${progressPct}%` }} />
      </div>

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
