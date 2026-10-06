/** "m:ss" / "h:mm:ss" with Latin digits (rendered inside <bdi dir="ltr"> in every locale). */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Keyboard map for the player (pure, so the shortcut table is unit-tested). */
export type PlayerKeyAction =
  | { type: "toggle" }
  | { type: "seekBy"; seconds: number }
  | { type: "seekTo"; fraction: number }
  | { type: "volumeBy"; delta: number }
  | { type: "mute" }
  | { type: "subtitles" }
  | { type: "fullscreen" };

export function keyAction(key: string, opts: { onSlider?: boolean } = {}): PlayerKeyAction | null {
  const k = key.length === 1 ? key.toLowerCase() : key;
  switch (k) {
    case " ":
    case "k":
      return { type: "toggle" };
    case "ArrowLeft":
      return opts.onSlider ? null : { type: "seekBy", seconds: -5 };
    case "ArrowRight":
      return opts.onSlider ? null : { type: "seekBy", seconds: 5 };
    case "j":
      return { type: "seekBy", seconds: -10 };
    case "l":
      return { type: "seekBy", seconds: 10 };
    case "ArrowUp":
      return opts.onSlider ? null : { type: "volumeBy", delta: 0.1 };
    case "ArrowDown":
      return opts.onSlider ? null : { type: "volumeBy", delta: -0.1 };
    case "Home":
      return opts.onSlider ? null : { type: "seekTo", fraction: 0 };
    case "End":
      return opts.onSlider ? null : { type: "seekTo", fraction: 1 };
    case "m":
      return { type: "mute" };
    case "c":
      return { type: "subtitles" };
    case "f":
      return { type: "fullscreen" };
    default:
      return null;
  }
}
