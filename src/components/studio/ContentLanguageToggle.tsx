"use client";

import type { LessonLanguage, LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";

const OPTIONS: { value: LessonLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

/** Segmented control: switches voice, board and captions together (chrome stays in `uiLanguage`). */
export function ContentLanguageToggle({
  value,
  uiLanguage,
  onChange,
}: {
  value: LessonLocale;
  uiLanguage: LessonLanguage;
  onChange: (next: LessonLocale) => void;
}) {
  const label = pickText(STUDIO_UI.contentLanguage, uiLanguage);
  return (
    <div className="studio-lang-seg" role="radiogroup" aria-label={label}>
      <span className="studio-lang-seg-label">{label}</span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "on" : ""}
          lang={option.value}
          dir="ltr"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
