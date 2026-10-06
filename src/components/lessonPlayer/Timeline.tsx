"use client";

import { fmt } from "@/lib/i18n/format";
import type { LessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import { formatClock } from "@/lib/lessonPlayer/format";
import type { VttCue } from "@/lib/lessonPlayer/vtt";

/** Seek bar (always LTR: time flows left → right in every locale) with buffered range and chapter ticks. */
export function Timeline({
  t,
  time,
  total,
  buffered,
  chapters,
  ready,
  onSeek,
}: {
  t: LessonPlayerMessages;
  time: number;
  total: number;
  buffered: number;
  chapters: readonly VttCue[];
  ready: boolean;
  onSeek: (time: number) => void;
}) {
  const progress = total ? Math.min(100, (time / total) * 100) : 0;
  const bufferedPct = total ? Math.min(100, (buffered / total) * 100) : 0;
  return (
    <div className="lp-timeline" dir="ltr">
      <div className="lp-track" aria-hidden="true">
        <span className="lp-buffered" style={{ width: `${bufferedPct}%` }} />
        <span className="lp-played" style={{ width: `${progress}%` }} />
        {total
          ? chapters.map((chapter, i) =>
              i === 0 ? null : <span key={chapter.start} className="lp-tick" style={{ left: `${(chapter.start / total) * 100}%` }} />,
            )
          : null}
      </div>
      <input
        className="lp-seek"
        type="range"
        min={0}
        max={total || 0}
        step={0.1}
        value={Math.min(time, total || 0)}
        disabled={!ready}
        aria-label={t.seek}
        aria-valuetext={fmt(t.seekValue, { current: formatClock(time), total: formatClock(total) })}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
    </div>
  );
}
