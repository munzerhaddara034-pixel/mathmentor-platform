"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LessonPhase, LessonTimeline } from "@/lib/studio/timeline";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI, toLessonLocale } from "@/lib/studio/i18n";
import { canvasStateAt, formatClock, segmentAt } from "@/lib/studio/timeline";
import { AvatarPlayer } from "./AvatarPlayer";
import { MathCanvas } from "./MathCanvas";

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

export function InteractiveLessonPlayer({
  timeline,
  initialLanguage,
}: {
  timeline: LessonTimeline;
  initialLanguage?: LessonLocale;
}) {
  const [uiLanguage, setUiLanguage] = useState<LessonLocale>(
    initialLanguage ?? toLessonLocale(timeline.defaultLanguage ?? timeline.language),
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekEpoch, setSeekEpoch] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoClock, setVideoClock] = useState(Boolean(timeline.media?.videoUrl));
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const lastTick = useRef<number | null>(null);
  const spokenKey = useRef<string | null>(null);

  const videoUrl = videoFailed ? undefined : timeline.media?.videoUrl;
  const clockMaster = Boolean(videoUrl) && videoClock;

  const segment = segmentAt(timeline, currentTime);
  const canvas = useMemo(() => canvasStateAt(timeline, currentTime), [timeline, currentTime]);
  const frozen = Boolean(segment && segment.avatar.state === "paused");
  const speaking = Boolean(playing && segment && segment.avatar.state === "speaking" && !frozen);
  const instructor = timeline.instructor ?? "Prof. Munzer Al-Tarah";

  useEffect(() => {
    setVideoFailed(false);
    setVideoClock(Boolean(timeline.media?.videoUrl));
    setVideoDuration(null);
  }, [timeline.media?.videoUrl]);

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

  const toggleLanguage = () => {
    setUiLanguage((current) => (current === "en" ? "fr" : "en"));
    spokenKey.current = null;
    if (playing && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const seek = (time: number) => {
    const next = Math.max(0, Math.min(timeline.durationSec, time));
    setCurrentTime(next);
    setSeekEpoch((value) => value + 1);
    spokenKey.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (videoUrl && (videoDuration == null || next <= videoDuration - 0.05)) setVideoClock(true);
    else if (videoUrl) setVideoClock(false);
  };

  const onVideoTime = (time: number) => {
    if (!clockMaster) return;
    setCurrentTime(Math.max(0, Math.min(timeline.durationSec, time)));
  };

  const onVideoEnded = () => {
    if (currentTime < timeline.durationSec - 0.05 && playing) {
      setVideoClock(false);
      return;
    }
    setPlaying(false);
    setCurrentTime(timeline.durationSec);
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
        <button className="btn dark studio-lang-toggle" type="button" onClick={toggleLanguage}>
          {uiLanguage === "en" ? STUDIO_UI.switchToFrench : STUDIO_UI.switchToEnglish}
        </button>
      </header>

      <div className="studio-phases">
        {timeline.segments.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`phase-chip ${segment?.id === item.id ? "active" : ""}`}
            onClick={() => seek(item.start + 0.05)}
          >
            {phaseLabel(item.phase, item.label)}
          </button>
        ))}
      </div>

      <div className="studio-split">
        <MathCanvas state={canvas} language={uiLanguage} currentTime={currentTime} />
        <AvatarPlayer
          language={uiLanguage}
          speaking={speaking}
          frozen={frozen}
          playing={playing}
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
            setVideoClock(false);
          }}
          onDuration={(duration) => setVideoDuration(duration)}
        />
      </div>

      <div className="studio-caption" aria-live="polite">
        <p>{segment ? pickText(segment.narration, uiLanguage) : ""}</p>
      </div>

      <div className="studio-controls">
        <button
          className="btn dark"
          type="button"
          onClick={() => {
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
    </div>
  );
}
