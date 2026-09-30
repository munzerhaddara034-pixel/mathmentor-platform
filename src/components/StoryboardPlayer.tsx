"use client";

import { useEffect, useState } from "react";
import type { StoryboardScene } from "@/lib/types";
import { useNs } from "@/components/i18n/useNs";
import { lessonsMessages } from "@/lib/i18n/ns/lessons";

export function StoryboardPlayer({ scenes, language }: { scenes: StoryboardScene[]; language: "ar" | "en" }) {
  const t = useNs(lessonsMessages);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || scenes.length === 0) return;
    const scene = scenes[index];
    const timer = window.setTimeout(() => {
      if (index < scenes.length - 1) setIndex((value) => value + 1);
      else setPlaying(false);
    }, scene.durationSeconds * 1000);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(scene.narration);
      utterance.lang = language === "ar" ? "ar-SA" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
    return () => {
      window.clearTimeout(timer);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [playing, index, scenes, language]);

  if (scenes.length === 0) {
    return <p className="muted">{t.storyNoVideo}</p>;
  }

  const scene = scenes[index];
  return (
    <div>
      <div className="scene">
        <p className="eyebrow">
          {t.storyDraft} · {index + 1}/{scenes.length}
        </p>
        <h3>{scene.title}</h3>
        <p>{scene.narration}</p>
        <div className="paper" style={{ marginTop: 16, color: "#10213d" }}>
          {scene.board}
        </div>
      </div>
      <div className="row">
        <button className="btn dark" type="button" onClick={() => { setIndex(0); setPlaying(true); }}>
          {playing ? t.storyPlaying : t.storyPlay}
        </button>
        <button className="btn" type="button" onClick={() => setPlaying(false)}>
          {t.storyStop}
        </button>
      </div>
    </div>
  );
}
