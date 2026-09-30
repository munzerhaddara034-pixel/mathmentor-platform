"use client";

import type { LessonLanguage } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import { formatClock } from "@/lib/studio/timeline";

const SPEEDS = [0.75, 1, 1.25, 1.5];

type Props = {
  ui: LessonLanguage;
  playing: boolean;
  currentTime: number;
  durationSec: number;
  speed: number;
  onPlayPause: () => void;
  onRestart: () => void;
  onSpeed: (speed: number) => void;
  onSeek: (time: number) => void;
};

export function PlayerControls({ ui, playing, currentTime, durationSec, speed, onPlayPause, onRestart, onSpeed, onSeek }: Props) {
  const progressPct = durationSec > 0 ? (currentTime / durationSec) * 100 : 0;
  return (
    <>
      <div className="studio-controls">
        <button className="btn dark" type="button" onClick={onPlayPause}>
          {playing ? pickText(STUDIO_UI.pause, ui) : pickText(STUDIO_UI.play, ui)}
        </button>
        <button className="btn" type="button" onClick={onRestart}>
          {pickText(STUDIO_UI.restart, ui)}
        </button>
        <label className="studio-speed">
          {pickText(STUDIO_UI.speed, ui)}
          <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))} dir="ltr">
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <bdi className="muted" dir="ltr">
          {formatClock(currentTime)} / {formatClock(durationSec)}
        </bdi>
        <input
          className="studio-seek"
          type="range"
          dir="ltr"
          min={0}
          max={durationSec}
          step={0.1}
          value={currentTime}
          aria-label={pickText(STUDIO_UI.seek, ui)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
      </div>
      <div className="progress-track" aria-hidden dir="ltr">
        <span style={{ width: `${progressPct}%` }} />
      </div>
    </>
  );
}
