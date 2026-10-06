"use client";

import { fmt } from "@/lib/i18n/format";
import type { LessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import { formatClock } from "@/lib/lessonPlayer/format";
import type { VttCue } from "@/lib/lessonPlayer/vtt";
import { Icon } from "./icons";
import { SettingsMenu } from "./SettingsMenu";
import { Timeline } from "./Timeline";
import type { LessonPlayback } from "./useLessonPlayback";

/** Bottom control bar: timeline, play, ±10 s, time, current chapter, mute/volume, subtitles, settings, full screen. */
export function PlayerControls({
  t,
  playback,
  chapters,
  currentChapter,
  hasSubtitles,
  subsOn,
  onToggleSubs,
}: {
  t: LessonPlayerMessages;
  playback: LessonPlayback;
  chapters: readonly VttCue[];
  currentChapter: number;
  hasSubtitles: boolean;
  subsOn: boolean;
  onToggleSubs: () => void;
}) {
  const { media, actions, muted, volume, muxed, renditions, quality, activeRendition } = playback;
  const total = media.duration || 0;
  const playLabel = media.playing ? t.pause : media.ended ? t.replay : t.play;
  const level = muted ? 0 : volume;
  return (
    <div className="lp-controls">
      <Timeline t={t} time={media.time} total={total} buffered={media.buffered} chapters={chapters} ready={media.ready} onSeek={actions.seek} />
      <div className="lp-bar">
        <button type="button" className="lp-btn" onClick={actions.togglePlay} disabled={!media.ready} aria-label={playLabel}>
          <Icon name={media.playing ? "pause" : media.ended ? "replay" : "play"} />
        </button>
        <button type="button" className="lp-btn lp-hide-xs" onClick={() => actions.seekBy(-10)} disabled={!media.ready} aria-label={fmt(t.back, { s: 10 })}>
          <Icon name="back" />
        </button>
        <button type="button" className="lp-btn lp-hide-xs" onClick={() => actions.seekBy(10)} disabled={!media.ready} aria-label={fmt(t.forward, { s: 10 })}>
          <Icon name="forward" />
        </button>
        <span className="lp-time">
          <bdi dir="ltr">
            {formatClock(media.time)} / {formatClock(total)}
          </bdi>
        </span>
        {chapters[currentChapter] ? (
          <span className="lp-chapter-now lp-hide-sm" dir="auto">
            {chapters[currentChapter].text}
          </span>
        ) : null}
        <span className="lp-spacer" />
        <button type="button" className="lp-btn" onClick={actions.toggleMute} aria-label={muted ? t.unmute : t.mute} aria-pressed={muted}>
          <Icon name={level === 0 ? "muted" : "volume"} />
        </button>
        <input
          className="lp-volume lp-hide-sm"
          type="range"
          min={0}
          max={1}
          step={0.05}
          dir="ltr"
          value={level}
          aria-label={t.volume}
          aria-valuetext={`${Math.round(level * 100)}%`}
          onChange={(event) => actions.setVolume(Number(event.target.value))}
        />
        {hasSubtitles ? (
          <button type="button" className={`lp-btn${subsOn ? " on" : ""}`} onClick={onToggleSubs} aria-label={subsOn ? t.subtitlesOff : t.subtitlesOn} aria-pressed={subsOn}>
            <Icon name="cc" />
          </button>
        ) : null}
        <SettingsMenu
          renditions={muxed ? [] : renditions}
          quality={quality}
          activeRendition={muxed ? null : activeRendition}
          onQuality={actions.changeQuality}
          rate={media.rate}
          onRate={actions.setRate}
          labels={{ quality: t.quality, qualityAuto: t.qualityAuto, speed: t.speed, settings: t.settings }}
        />
        <button type="button" className="lp-btn" onClick={actions.toggleFullscreen} aria-label={media.fullscreen ? t.exitFullscreen : t.fullscreen}>
          <Icon name={media.fullscreen ? "exitFullscreen" : "fullscreen"} />
        </button>
      </div>
    </div>
  );
}
