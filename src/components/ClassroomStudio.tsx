"use client";

import { useEffect, useRef, useState } from "react";
import type { StoryboardScene } from "@/lib/types";

function pickEnglishVoice() {
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  return (
    voices.find((voice) => /en-US/i.test(voice.lang) && /david|mark|guy|ryan|george|andrew/i.test(voice.name)) ||
    voices.find((voice) => /en-US/i.test(voice.lang)) ||
    voices[0]
  );
}

export function ClassroomStudio({
  scenes,
  heading,
  watermark = "طالب المنصة · 76532421",
}: {
  scenes: StoryboardScene[];
  heading: string;
  watermark?: string;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [written, setWritten] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    const remember = () => pickEnglishVoice();
    remember();
    window.speechSynthesis.addEventListener("voiceschanged", remember);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", remember);
  }, []);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    const board = scenes[index]?.board ?? "";
    setWritten("");
    if (!playing) {
      setWritten(board);
      return;
    }
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setWritten(board.slice(0, i));
      if (i >= board.length) window.clearInterval(timer);
    }, 28);
    return () => window.clearInterval(timer);
  }, [index, playing, scenes]);

  useEffect(() => {
    if (!playing || scenes.length === 0) return;
    const scene = scenes[index];
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(scene.narration);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    const voice = pickEnglishVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (indexRef.current < scenes.length - 1) setIndex((value) => value + 1);
      else setPlaying(false);
    };
    window.speechSynthesis.speak(utterance);
    return () => {
      utterance.onend = null;
      window.speechSynthesis.cancel();
    };
  }, [playing, index, scenes]);

  if (!scenes.length) return null;
  const scene = scenes[index];

  return (
    <div className="classroom video-secure" onContextMenu={(event) => event.preventDefault()}>
      <div className="classroom-view">
        <img className="students-photo" src="/classroom/students.jpg" alt="Students watching the board" draggable={false} />
        <p className="classroom-tag">Protected classroom · no download</p>
        <span className="dynamic-watermark">{watermark}</span>
        <span className="dynamic-watermark delay">{watermark}</span>
      </div>
      <div className="stage-row">
        <div className="teacher-col">
          <img className="teacher-photo" src="/teachers/munzer.jpg?v=4" alt="Professor Munzer Haddara" />
          <p className="teacher-nameplate">Professor Munzer · writing now</p>
        </div>
        <div className="live-board">
          <p className="eyebrow">Whiteboard</p>
          <h3>{heading}</h3>
          <p className="muted" style={{ color: "#c7d4e6" }}>
            {scene.title}
          </p>
          <pre className={`board-text writing ${playing ? "pen" : ""}`}>{written}
            <span className="cursor">▌</span>
          </pre>
        </div>
      </div>
      <p className="caption">{scene.narration}</p>
      <div className="row">
        <button
          className="btn dark"
          type="button"
          onClick={() => {
            setIndex(0);
            setPlaying(true);
          }}
        >
          {playing ? "Professor is teaching…" : "Start classroom video"}
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
          Scene {index + 1} / {scenes.length} · English voice · writing on the board
        </span>
      </div>
    </div>
  );
}
