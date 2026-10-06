/** Inline 24px icons (no icon font / library). Decorative: the buttons carry the aria-label. */
type IconProps = { name: IconName };
export type IconName = "play" | "pause" | "replay" | "volume" | "muted" | "cc" | "settings" | "fullscreen" | "exitFullscreen" | "back" | "forward";

const PATHS: Record<IconName, string> = {
  play: "M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  replay: "M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z",
  volume: "M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-8.3v2.1a7 7 0 0 1 0 12.4v2.1a9 9 0 0 0 0-16.6Z",
  muted: "M4 9v6h4l5 4V5L8 9H4Zm12.6-.4L15.2 10l2 2-2 2 1.4 1.4 2-2 2 2 1.4-1.4-2-2 2-2-1.4-1.4-2 2-2-2Z",
  cc: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3.5 4A2.5 2.5 0 0 0 5 11.5v1A2.5 2.5 0 0 0 7.5 15H10v-1.6H7.5a.9.9 0 0 1-.9-.9v-1a.9.9 0 0 1 .9-.9H10V9H7.5Zm7 0a2.5 2.5 0 0 0-2.5 2.5v1a2.5 2.5 0 0 0 2.5 2.5H17v-1.6h-2.5a.9.9 0 0 1-.9-.9v-1a.9.9 0 0 1 .9-.9H17V9h-2.5Z",
  settings:
    "M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5L19.4 13ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z",
  fullscreen: "M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z",
  exitFullscreen: "M8 4h2v6H4V8h4V4Zm6 0h2v4h4v2h-6V4ZM4 14h6v6H8v-4H4v-2Zm10 0h6v2h-4v4h-2v-6Z",
  back: "M11 6V3L6 7.5 11 12V9a5 5 0 1 1-5 5H4a7 7 0 1 0 7-8Z",
  forward: "M13 6V3l5 4.5-5 4.5V9a5 5 0 1 0 5 5h2a7 7 0 1 1-7-8Z",
};

export function Icon({ name }: IconProps) {
  return (
    <svg className="lp-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  );
}
