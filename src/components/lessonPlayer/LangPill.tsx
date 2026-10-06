"use client";

import { useRef, type KeyboardEvent } from "react";
import type { LessonLang } from "@/lib/lessonPlayer/manifest";

/** Visible labels are endonyms (EN / العربية / FR); aria-labels are localised full names. */
const SHORT: Record<LessonLang, string> = { en: "EN", ar: "العربية", fr: "FR" };

/** Roving radio group: arrows move the selection; horizontal arrows follow the visual (RTL-aware) order. */
function arrowStep(key: string, rtl: boolean): number {
  if (key === "ArrowRight") return rtl ? -1 : 1;
  if (key === "ArrowLeft") return rtl ? 1 : -1;
  if (key === "ArrowDown") return 1;
  if (key === "ArrowUp") return -1;
  return 0;
}

export function LangPill({
  langs,
  value,
  onChange,
  label,
  names,
  disabled,
}: {
  langs: readonly LessonLang[];
  value: LessonLang;
  onChange: (lang: LessonLang) => void;
  label: string;
  names: Record<LessonLang, string>;
  disabled?: boolean;
}) {
  const refs = useRef<Partial<Record<LessonLang, HTMLButtonElement | null>>>({});
  const index = Math.max(0, langs.indexOf(value));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = arrowStep(event.key, getComputedStyle(event.currentTarget).direction === "rtl");
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    const next = langs[(index + step + langs.length) % langs.length];
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="lp-pill" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {langs.map((lang) => {
        const on = lang === value;
        return (
          <button
            key={lang}
            ref={(node) => {
              refs.current[lang] = node;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={names[lang]}
            tabIndex={on ? 0 : -1}
            className={on ? "on" : undefined}
            lang={lang}
            dir={lang === "ar" ? "rtl" : "ltr"}
            disabled={disabled}
            onClick={() => !on && onChange(lang)}
          >
            {SHORT[lang]}
          </button>
        );
      })}
    </div>
  );
}
