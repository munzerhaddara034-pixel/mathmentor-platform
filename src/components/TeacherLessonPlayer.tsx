"use client";

import { useEffect, useRef, useState } from "react";
import type { StoryboardScene } from "@/lib/types";

function englishVoices() {
  return window.speechSynthesis.getVoices().filter((voice) => {
    const lang = voice.lang.replace("_", "-").toLowerCase();
    return lang.startsWith("en");
  });
}

function pickEnglishVoice() {
  const voices = englishVoices();
  return (
    voices.find((voice) => /en-US/i.test(voice.lang) && /male|david|mark|guy|ryan|george|andrew|steffan/i.test(voice.name)) ||
    voices.find((voice) => /en-GB/i.test(voice.lang) && /male|daniel|george|ryan/i.test(voice.name)) ||
    voices.find((voice) => /en-US/i.test(voice.lang)) ||
    voices[0]
  );
}

export function TeacherLessonPlayer({
  scenes,
  teacherName = "Professor Munzer Haddara",
}: {
  scenes: StoryboardScene[];
  language?: "en";
  teacherName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voiceName, setVoiceName] = useState("English");
  const indexRef = useRef(0);

  useEffect(() => {
    const remember = () => {
      const voice = pickEnglishVoice();
      if (voice) setVoiceName(voice.name);
    };
    remember();
    window.speechSynthesis.addEventListener("voiceschanged", remember);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", remember);
  }, []);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (!playing || scenes.length === 0) return;
    const scene = scenes[index];
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(scene.narration);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    const voice = pickEnglishVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "en-US";
    }

    utterance.onend = () => {
      if (!playing) return;
      if (indexRef.current < scenes.length - 1) setIndex((value) => value + 1);
      else setPlaying(false);
    };

    window.speechSynthesis.speak(utterance);

    return () => {
      utterance.onend = null;
      window.speechSynthesis.cancel();
    };
  }, [playing, index, scenes]);

  if (scenes.length === 0) return <p className="muted">No video scenes yet.</p>;
  const scene = scenes[index];
  const progress = ((index + 1) / scenes.length) * 100;

  return (
    <div className="lesson-stage">
      <div className={`video-frame ${playing ? "speaking" : ""}`}>
        <div className="teacher-col">
          <img className="teacher-photo" src="/teachers/munzer.jpg?v=4" alt={teacherName} />
          <p className="teacher-nameplate">{teacherName}</p>
        </div>
        <div className="board-panel">
          <p className="eyebrow">English voice · {voiceName}</p>
          <h3>{scene.title}</h3>
          {scene.boardImage ? (
            <img className="board-image" src={scene.boardImage} alt={scene.title} />
          ) : (
            <pre className="board-text">{scene.board}</pre>
          )}
        </div>
        <p className="caption">{scene.narration}</p>
      </div>
      <div className="progress-track" aria-hidden>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="row">
        <button
          className="btn dark"
          type="button"
          onClick={() => {
            setIndex(0);
            setPlaying(true);
          }}
        >
          {playing ? "Playing English voice…" : "Play in English"}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setPlaying(false);
            window.speechSynthesis.cancel();
          }}
        >
          Stop
        </button>
        <span className="muted">
          Scene {index + 1} / {scenes.length} · written + spoken English
        </span>
      </div>
    </div>
  );
}
