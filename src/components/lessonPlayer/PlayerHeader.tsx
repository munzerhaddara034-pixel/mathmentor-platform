"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { LessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import type { LessonLang } from "@/lib/lessonPlayer/manifest";
import { LangPill } from "./LangPill";

/** Brand «منذر حداره · MathMentor» · presenter "Dr. Mohamed · Munzer's assistant" + AI badge · optional AI-voice label · language pill. */
export function PlayerHeader({
  t,
  aiVoice,
  langs,
  lang,
  onLang,
  langNames,
  ready,
}: {
  t: LessonPlayerMessages;
  aiVoice: boolean;
  langs: readonly LessonLang[];
  lang: LessonLang;
  onLang: (lang: LessonLang) => void;
  langNames: Record<LessonLang, string>;
  ready: boolean;
}) {
  const { locale, m } = useI18n();
  return (
    <header className="lp-head">
      <div className="lp-id">
        <span className="lp-brand">{m.brand.aria}</span>
        <span className="lp-presenter" aria-label={`${t.presenter}: ${m.persona.label}`}>
          <span className="lp-avatar" aria-hidden="true">
            {locale === "ar" ? "م" : "M"}
          </span>
          <span className="lp-presenter-name">{m.persona.name}</span>
          <span className="lp-badge lp-badge-ai" aria-hidden="true">
            {m.persona.ai}
          </span>
          {aiVoice ? (
            <span className="lp-badge lp-badge-voice" aria-hidden="true">
              {t.aiVoice}
            </span>
          ) : null}
        </span>
        {aiVoice ? <span className="lp-sr">{t.aiVoice}</span> : null}
      </div>
      {langs.length > 1 ? (
        <LangPill langs={langs} value={lang} onChange={onLang} label={t.audioLanguage} names={langNames} disabled={!ready} />
      ) : langs.length === 1 ? (
        <span className="lp-pill lp-pill-single" lang={langs[0]}>
          {langNames[langs[0]]}
        </span>
      ) : null}
    </header>
  );
}
