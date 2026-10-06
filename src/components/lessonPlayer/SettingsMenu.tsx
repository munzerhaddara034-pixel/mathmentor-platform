"use client";

import { useEffect, useRef, useState } from "react";
import type { Rendition } from "@/lib/lessonPlayer/manifest";
import { Icon } from "./icons";

export type QualityChoice = "auto" | Rendition;
export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

/** Popover with Quality (Auto + present renditions) and Speed radio items. Esc / outside click closes it. */
export function SettingsMenu({
  renditions,
  quality,
  activeRendition,
  onQuality,
  rate,
  onRate,
  labels,
}: {
  renditions: readonly Rendition[];
  quality: QualityChoice;
  activeRendition: Rendition | null;
  onQuality: (choice: QualityChoice) => void;
  rate: number;
  onRate: (rate: number) => void;
  labels: { quality: string; qualityAuto: string; speed: string; settings: string };
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onMenuKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
    next?.focus();
  };

  const autoSuffix = quality === "auto" && activeRendition ? ` (${activeRendition}p)` : "";

  return (
    <div className="lp-menu-root" ref={root}>
      <button
        ref={button}
        type="button"
        className="lp-btn"
        aria-label={labels.settings}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="settings" />
        {activeRendition ? <span className="lp-hd-tag" aria-hidden="true">{activeRendition}p</span> : null}
      </button>
      {open ? (
        <div className="lp-menu" role="menu" aria-label={labels.settings} onKeyDown={onMenuKey}>
          {renditions.length > 1 ? (
            <div role="group" aria-label={labels.quality}>
              <p className="lp-menu-title" aria-hidden="true">{labels.quality}</p>
              <button type="button" role="menuitemradio" aria-checked={quality === "auto"} onClick={() => { onQuality("auto"); close(); }}>
                {labels.qualityAuto}
                <bdi dir="ltr">{autoSuffix}</bdi>
              </button>
              {renditions.map((key) => (
                <button key={key} type="button" role="menuitemradio" aria-checked={quality === key} onClick={() => { onQuality(key); close(); }}>
                  <bdi dir="ltr">{key}p</bdi>
                </button>
              ))}
            </div>
          ) : null}
          <div role="group" aria-label={labels.speed}>
            <p className="lp-menu-title" aria-hidden="true">{labels.speed}</p>
            {SPEEDS.map((speed) => (
              <button key={speed} type="button" role="menuitemradio" aria-checked={rate === speed} onClick={() => { onRate(speed); close(); }}>
                <bdi dir="ltr">{speed}×</bdi>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
