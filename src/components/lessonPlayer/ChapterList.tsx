"use client";

import { fmt } from "@/lib/i18n/format";
import type { LessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import { formatClock } from "@/lib/lessonPlayer/format";
import type { VttCue } from "@/lib/lessonPlayer/vtt";

/** Chapters from the optional chapters.vtt (one per storyboard scene); click to jump. */
export function ChapterList({
  t,
  chapters,
  current,
  ready,
  onSeek,
}: {
  t: LessonPlayerMessages;
  chapters: readonly VttCue[];
  current: number;
  ready: boolean;
  onSeek: (time: number) => void;
}) {
  if (!chapters.length) return null;
  return (
    <nav className="lp-chapters" aria-label={t.chapters}>
      <h2 className="lp-chapters-title">{t.chapters}</h2>
      <ol>
        {chapters.map((chapter, i) => (
          <li key={`${chapter.start}-${i}`}>
            <button type="button" aria-current={i === current ? "step" : undefined} onClick={() => onSeek(chapter.start)} disabled={!ready}>
              <bdi dir="ltr" className="lp-chapter-time">
                {formatClock(chapter.start)}
              </bdi>
              <span dir="auto">{chapter.text || fmt(t.chapter, { n: i + 1 })}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
