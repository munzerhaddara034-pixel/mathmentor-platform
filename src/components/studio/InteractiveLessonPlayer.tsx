"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LessonLanguage, LessonPhase, LessonTimeline } from "@/lib/studio/timeline";
import {
  canvasStateAt,
  formatClock,
  graphIsAnimating,
  pickText,
  segmentAt,
} from "@/lib/studio/timeline";
import { AvatarPlayer } from "./AvatarPlayer";
import { MathCanvas } from "./MathCanvas";

const PHASE_LABEL: Record<LessonPhase, { ar: string; en: string }> = {
  introduction: { ar: "1. تعريف الفكرة", en: "1. Concept definition" },
  rule_graph: { ar: "2. القاعدة والرسم", en: "2. Rule & graph" },
  real_example: { ar: "3. مثال محلول", en: "3. Worked example" },
  common_mistake: { ar: "4. خطأ شائع", en: "4. Common mistake" },
};

const SPEEDS = [0.75, 1, 1.25, 1.5];

function pickVoice(language: LessonLanguage) {
  const voices = window.speechSynthesis.getVoices();
  if (language === "ar") {
    return voices.find((voice) => voice.lang.toLowerCase().startsWith("ar"));
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
  initialLanguage?: LessonLanguage;
}) {
  const [uiLanguage, setUiLanguage] = useState<LessonLanguage>(initialLanguage ?? timeline.language);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const lastTick = useRef<number | null>(null);
  const spokenSegment = useRef<string | null>(null);

  const segment = segmentAt(timeline, currentTime);
  const canvas = useMemo(() => canvasStateAt(timeline, currentTime), [timeline, currentTime]);
  const animatingGraph = graphIsAnimating(canvas, currentTime, 5);
  const frozen = Boolean(segment && (segment.avatar.state === "paused" || animatingGraph));
  const speaking = Boolean(playing && segment && segment.avatar.state === "speaking" && !frozen);

  useEffect(() => {
    if (!playing) {
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
  }, [playing, speed, timeline.durationSec]);

  const speakSegment = useCallback(
    (id: string | undefined, text: string) => {
      if (!("speechSynthesis" in window) || !id) return;
      if (spokenSegment.current === id) return;
      spokenSegment.current = id;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = uiLanguage === "ar" ? "ar-SA" : "en-US";
      utterance.rate = Math.min(1.4, Math.max(0.7, speed * 0.9));
      const voice = pickVoice(uiLanguage);
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    },
    [speed, uiLanguage],
  );

  useEffect(() => {
    if (!playing || !segment || frozen) {
      if (!playing && "speechSynthesis" in window) window.speechSynthesis.cancel();
      if (!playing) spokenSegment.current = null;
      return;
    }
    speakSegment(segment.id, pickText(segment.narration, uiLanguage));
  }, [frozen, playing, segment, speakSegment, uiLanguage]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const seek = (time: number) => {
    setCurrentTime(Math.max(0, Math.min(timeline.durationSec, time)));
    spokenSegment.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const progressPct = (currentTime / timeline.durationSec) * 100;

  return (
    <div className="studio-player" dir={uiLanguage === "ar" ? "rtl" : "ltr"}>
      <header className="studio-head">
        <div>
          <p className="eyebrow">مشغل الدروس الشارحة والسبورة الذكية</p>
          <h1>{pickText(timeline.title, uiLanguage)}</h1>
          <p className="muted">
            {timeline.grade ? `${timeline.grade} · ` : ""}
            {timeline.topic ?? ""}
            {" · "}
            {languageToggleHint(uiLanguage)}
          </p>
        </div>
        <div className="row" style={{ marginTop: 0 }}>
          <button
            className={`btn ${uiLanguage === "ar" ? "dark" : ""}`}
            type="button"
            onClick={() => setUiLanguage("ar")}
          >
            AR
          </button>
          <button
            className={`btn ${uiLanguage === "en" ? "dark" : ""}`}
            type="button"
            onClick={() => setUiLanguage("en")}
          >
            EN
          </button>
        </div>
      </header>

      <div className="studio-phases">
        {timeline.segments.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`phase-chip ${segment?.id === item.id ? "active" : ""}`}
            onClick={() => seek(item.start + 0.05)}
          >
            {pickText(PHASE_LABEL[item.phase], uiLanguage)}
          </button>
        ))}
      </div>

      <div className="studio-split">
        <AvatarPlayer
          language={uiLanguage}
          speaking={speaking}
          frozen={frozen}
          playing={playing}
          currentTime={currentTime}
          videoUrl={timeline.media?.videoUrl}
          audioUrl={timeline.media?.audioUrl}
          poster={timeline.media?.poster ?? "/teachers/munzer.jpg?v=4"}
        />
        <MathCanvas state={canvas} language={uiLanguage} currentTime={currentTime} />
      </div>

      <div className="studio-caption">
        <p>{segment ? pickText(segment.narration, uiLanguage) : ""}</p>
      </div>

      <div className="studio-controls">
        <button
          className="btn dark"
          type="button"
          onClick={() => {
            if (currentTime >= timeline.durationSec) setCurrentTime(0);
            setPlaying((value) => !value);
          }}
        >
          {playing ? (uiLanguage === "ar" ? "إيقاف مؤقت" : "Pause") : uiLanguage === "ar" ? "تشغيل" : "Play"}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setPlaying(false);
            seek(0);
          }}
        >
          {uiLanguage === "ar" ? "من البداية" : "Restart"}
        </button>
        <label className="studio-speed">
          {uiLanguage === "ar" ? "السرعة" : "Speed"}
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
          aria-label={uiLanguage === "ar" ? "شريط الزمن" : "Seek"}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </div>
      <div className="progress-track" aria-hidden>
        <span style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}

function languageToggleHint(language: LessonLanguage) {
  return language === "ar" ? "النص على الشاشة: عربي (بدّل إلى EN)" : "On-screen text: English (switch to AR)";
}
