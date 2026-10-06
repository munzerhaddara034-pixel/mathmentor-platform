"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { Rendition } from "@/lib/lessonPlayer/manifest";
import { Icon } from "./icons";

export type QualityChoice = "auto" | Rendition;
export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

type Labels = { quality: string; qualityAuto: string; speed: string; settings: string };
type Item = { key: string; checked: boolean; label: ReactNode; select: () => void };

/** Close on outside pointer; focus the checked item when opening. */
function useMenuFocus(root: RefObject<HTMLDivElement | null>, open: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [root, open, setOpen]);
}

function MenuGroup({ title, items, onPick }: { title: string; items: Item[]; onPick: () => void }) {
  return (
    <div role="group" aria-label={title}>
      <p className="lp-menu-title" aria-hidden="true">
        {title}
      </p>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitemradio"
          aria-checked={item.checked}
          onClick={() => {
            item.select();
            onPick();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Popover with Quality (Auto + present renditions) and Speed radio items. Esc / outside click closes it. */
export function SettingsMenu(props: {
  renditions: readonly Rendition[];
  quality: QualityChoice;
  activeRendition: Rendition | null;
  onQuality: (choice: QualityChoice) => void;
  rate: number;
  onRate: (rate: number) => void;
  labels: Labels;
}) {
  const { renditions, quality, activeRendition, onQuality, rate, onRate, labels } = props;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useMenuFocus(root, open, setOpen);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") return close();
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };
  const autoSuffix = quality === "auto" && activeRendition ? ` (${activeRendition}p)` : "";
  const qualityItems: Item[] = [
    { key: "auto", checked: quality === "auto", label: <>{labels.qualityAuto}<bdi dir="ltr">{autoSuffix}</bdi></>, select: () => onQuality("auto") },
    ...renditions.map((key) => ({ key, checked: quality === key, label: <bdi dir="ltr">{key}p</bdi>, select: () => onQuality(key) })),
  ];
  const speedItems: Item[] = SPEEDS.map((speed) => ({ key: String(speed), checked: rate === speed, label: <bdi dir="ltr">{speed}×</bdi>, select: () => onRate(speed) }));

  return (
    <div className="lp-menu-root" ref={root}>
      <button ref={button} type="button" className="lp-btn" aria-label={labels.settings} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Icon name="settings" />
        {activeRendition ? (
          <span className="lp-hd-tag" aria-hidden="true">
            {activeRendition}p
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="lp-menu" role="menu" aria-label={labels.settings} onKeyDown={onMenuKey}>
          {renditions.length > 1 ? <MenuGroup title={labels.quality} items={qualityItems} onPick={close} /> : null}
          <MenuGroup title={labels.speed} items={speedItems} onPick={close} />
        </div>
      ) : null}
    </div>
  );
}
