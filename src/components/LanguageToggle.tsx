"use client";

import type { LessonLang } from "@/lib/lessonNotes";

const OPTIONS: Array<{ value: LessonLang; label: string; name: string }> = [
  { value: "en", label: "EN", name: "English" },
  { value: "ar", label: "AR", name: "Arabic" },
  { value: "fr", label: "FR", name: "French" },
];

export function LanguageToggle({
  lang,
  onChange,
  disabled,
}: {
  lang: LessonLang;
  onChange: (lang: LessonLang) => void;
  disabled?: boolean;
}) {
  return (
    <div className="lang-toggle" role="radiogroup" aria-label="Lesson language" aria-busy={disabled ? true : undefined}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={lang === option.value}
          aria-label={option.name}
          lang={option.value}
          dir="ltr"
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
