"use client";

import type { LessonChapter } from "@/lib/studio/timeline";
import { chapterAt, formatClock } from "@/lib/studio/timeline";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";

export function ChapterScrubBar({
  chapters,
  durationSec,
  currentTime,
  language,
  onSeek,
}: {
  chapters: LessonChapter[];
  durationSec: number;
  currentTime: number;
  language: LessonLocale;
  onSeek: (time: number) => void;
}) {
  if (chapters.length === 0 || durationSec <= 0) return null;
  const active = chapterAt(chapters, currentTime);
  const progress = Math.max(0, Math.min(100, (currentTime / durationSec) * 100));

  return (
    <div className="studio-chapters" aria-label={pickText(STUDIO_UI.chapters, language)}>
      <div className="studio-chapters-head">
        <p className="eyebrow">{pickText(STUDIO_UI.chapters, language)}</p>
        <span className="muted">
          {active ? pickText(active.label, language) : ""} · {formatClock(currentTime)}
        </span>
      </div>
      <div className="studio-chapters-track" aria-hidden>
        <span className="studio-chapters-fill" style={{ width: `${progress}%` }} />
        {chapters.map((chapter) => (
          <i
            key={`mark-${chapter.id}`}
            className={`studio-chapter-mark ${active?.id === chapter.id ? "active" : ""}`}
            style={{ left: `${Math.max(0, Math.min(100, (chapter.at / durationSec) * 100))}%` }}
          />
        ))}
      </div>
      <div className="studio-chapter-row" role="tablist">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            role="tab"
            aria-selected={active?.id === chapter.id}
            className={`studio-chapter-btn ${active?.id === chapter.id ? "active" : ""}`}
            onClick={() => onSeek(chapter.at + 0.05)}
          >
            <span>{pickText(chapter.label, language)}</span>
            <small>{formatClock(chapter.at)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
