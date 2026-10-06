"use client";

import type { KeyboardEvent } from "react";
import { keyAction, type PlayerKeyAction } from "@/lib/lessonPlayer/format";
import type { LessonPlayback } from "./useLessonPlayback";

/** Keyboard shortcuts on the media frame (Space/K, ←/→, J/L, ↑/↓, Home/End, M, C, F). */
export function usePlayerKeys(playback: LessonPlayback, toggleSubtitles: () => void) {
  const { actions, media, volume } = playback;
  const run = (action: PlayerKeyAction) => {
    switch (action.type) {
      case "toggle":
        return actions.togglePlay();
      case "seekBy":
        return actions.seekBy(action.seconds);
      case "seekTo":
        return actions.seek(action.fraction * (media.duration || 0));
      case "volumeBy":
        return actions.setVolume(volume + action.delta);
      case "mute":
        return actions.toggleMute();
      case "subtitles":
        return toggleSubtitles();
      case "fullscreen":
        return actions.toggleFullscreen();
    }
  };
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.closest(".lp-menu, .lp-pill")) return;
    if ((event.key === " " || event.key === "Enter") && target.tagName === "BUTTON") return;
    const action = keyAction(event.key, { onSlider: target instanceof HTMLInputElement && target.type === "range" });
    if (!action) return;
    event.preventDefault();
    run(action);
  };
}
