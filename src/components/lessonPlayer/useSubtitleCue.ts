"use client";

import { useEffect, useState, type RefObject } from "react";
import type { LessonLang } from "@/lib/lessonPlayer/manifest";

function cueText(track: TextTrack): string {
  const cues = track.activeCues;
  if (!cues) return "";
  const lines: string[] = [];
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i] as TextTrackCue & { text?: string };
    if (cue.text) lines.push(cue.text.replace(/<[^>]+>/g, ""));
  }
  return lines.join("\n");
}

/**
 * The active subtitle track is "hidden" (cues fire, the player renders them in its own overlay so RTL and
 * styling are under our control); every other track is "disabled" so the browser does not fetch it.
 */
export function useSubtitleCue(videoRef: RefObject<HTMLVideoElement | null>, lang: LessonLang | null, on: boolean, ready: boolean): string {
  const [cue, setCue] = useState("");
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active: TextTrack | null = null;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      const track = video.textTracks[i];
      if (track.kind !== "subtitles") continue;
      const show = on && track.language === lang;
      track.mode = show ? "hidden" : "disabled";
      if (show) active = track;
    }
    if (!active) {
      setCue("");
      return;
    }
    const track = active;
    const update = () => setCue(cueText(track));
    update();
    track.addEventListener("cuechange", update);
    return () => track.removeEventListener("cuechange", update);
  }, [videoRef, lang, on, ready]);
  return cue;
}
