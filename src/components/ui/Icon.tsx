/** Small stroke icon set (24px grid) used by the redesigned shell. Decorative by default. */
export type IconName =
  | "home"
  | "book"
  | "camera"
  | "video"
  | "user"
  | "bell"
  | "menu"
  | "close"
  | "exam"
  | "layers"
  | "calendar"
  | "clock"
  | "play"
  | "check"
  | "arrow"
  | "chat"
  | "fire"
  | "chevron"
  | "wallet"
  | "spark"
  | "sun"
  | "moon"
  | "mic"
  | "send"
  | "board"
  | "back"
  | "image"
  | "globe"
  | "settings";

/**
 * Drawn for LTR ("arrow" = forward → right, "back" = ←, "send" = ↗). In RTL documents they are mirrored by
 * `.mm-icon-dir` (see shell.css), so the same name keeps its meaning in every locale.
 */
const DIRECTIONAL = new Set<IconName>(["arrow", "back", "send"]);

const PATHS: Record<IconName, string[]> = {
  home: ["M3 11.5 12 4l9 7.5", "M5.5 10v9.5h13V10", "M10 19.5v-5h4v5"],
  book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z", "M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5", "M9 8h7M9 11.5h5"],
  camera: ["M4 8h3l1.8-2.5h6.4L17 8h3v11H4z", "M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"],
  video: ["M5.5 6h8A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6z", "m16 10.5 5-3v9l-5-3"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"],
  bell: ["M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z", "M10 20.5a2 2 0 0 0 4 0"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  close: ["M6 6l12 12M18 6 6 18"],
  exam: ["M7.5 4h9A2.5 2.5 0 0 1 19 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5v-12A2.5 2.5 0 0 1 7.5 4z", "M9 4V2.8h6V4", "m8.5 12 2 2 4-4.5M8.5 17.5h7"],
  layers: ["m12 3 9 5-9 5-9-5z", "m3 13 9 5 9-5"],
  calendar: ["M6 5h12a2.5 2.5 0 0 1 2.5 2.5v10.5a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V7.5A2.5 2.5 0 0 1 6 5z", "M3.5 10h17M8 3v4M16 3v4"],
  clock: ["M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z", "M12 7.5V12l3 2"],
  play: ["M8 5.5v13l10-6.5z"],
  check: ["m5 12.5 4.5 4.5L19 7.5"],
  arrow: ["M5 12h14M13 6l6 6-6 6"],
  chat: ["M4 5h16v11H9l-5 4z", "M8.5 9.5h7M8.5 12.5h4.5"],
  fire: ["M12 21c-3.9 0-7-2.8-7-6.6 0-3.1 2-5.2 3.6-7 .4 1.9 1.4 3 2.6 3.4C11 7.8 12.3 5 14.6 3c.2 3 3.4 5.4 4.2 8.4.9 4.4-2.3 9.6-6.8 9.6z"],
  chevron: ["m6 9 6 6 6-6"],
  wallet: ["M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z", "M15 12h4"],
  sun: ["M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z", "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  mic: ["M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15z", "M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"],
  send: ["M20 4 3.5 11l6.5 2.5L12.5 20z", "m20 4-10 9.5"],
  board: ["M3.5 5h17v11h-17z", "M8 20l4-4 4 4", "m6.5 13 3-3.5 2.5 2 4.5-4.5"],
  back: ["M19 12H5M11 6l-6 6 6 6"],
  image: ["M4 5h16v14H4z", "m4 16 5-5 4 4 2.5-2.5L20 16", "M15.5 9.5h.01"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M3 12h18", "M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9s1.3-6.4 3.8-9z"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z"],
  spark: ["M12 3v4M12 17v4M3 12h4M17 12h4", "m6.5 6.5 2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5"],
};

export function Icon({
  name,
  size = 24,
  className,
  label,
  filled = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  /** Accessible label; omit for decorative icons. */
  label?: string;
  filled?: boolean;
}) {
  return (
    <svg
      className={`mm-icon${DIRECTIONAL.has(name) ? " mm-icon-dir" : ""}${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
