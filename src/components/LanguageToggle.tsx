"use client";

import type { LessonLang } from "@/lib/lessonNotes";

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
    <div className="lang-toggle" role="group" aria-label="Lesson language">
      <button type="button" aria-pressed={lang === "en"} disabled={disabled} onClick={() => onChange("en")}>
        EN
      </button>
      <button type="button" aria-pressed={lang === "fr"} disabled={disabled} onClick={() => onChange("fr")}>
        FR
      </button>
    </div>
  );
}
