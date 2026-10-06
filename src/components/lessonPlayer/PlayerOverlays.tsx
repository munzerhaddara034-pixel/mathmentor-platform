"use client";

import type { LessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import type { LessonLang } from "@/lib/lessonPlayer/manifest";
import type { MediaState } from "./mediaState";
import { Icon } from "./icons";

/** Subtitle line, buffering/switching status pill and the big centre play button. */
export function PlayerOverlays({
  t,
  media,
  cue,
  cueLang,
  onToggle,
}: {
  t: LessonPlayerMessages;
  media: MediaState;
  cue: string;
  cueLang: LessonLang | null;
  onToggle: () => void;
}) {
  const status = !media.ready
    ? ""
    : media.switching
      ? t.switching
      : media.holding
        ? t.buffering
        : media.videoWaiting && media.playing
          ? t.loading
          : "";
  const showBigPlay = media.ready && !media.playing && !media.switching;
  return (
    <>
      {cue ? (
        <div className="lp-cue" lang={cueLang ?? undefined} dir={cueLang === "ar" ? "rtl" : "ltr"}>
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
        <button type="button" className="lp-bigplay" aria-label={media.ended ? t.replay : t.play} onClick={onToggle}>
          <Icon name={media.ended ? "replay" : "play"} />
        </button>
      ) : null}
    </>
  );
}
