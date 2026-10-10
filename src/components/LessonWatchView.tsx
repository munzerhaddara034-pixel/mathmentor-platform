"use client";

import Link from "next/link";
import { useState } from "react";
import { LessonNotes } from "@/components/LessonNotes";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { Ltr } from "@/components/ui/Ltr";
import { useI18n } from "@/components/i18n/I18nProvider";
import { saveLocale } from "@/components/i18n/LocaleSwitcher";
import { useNs } from "@/components/i18n/useNs";
import { lessonsMessages } from "@/lib/i18n/ns/lessons";
import { getAcademyLesson } from "@/lib/academyLessons";
import { DEFAULT_LESSON_LANG, type LessonLang } from "@/lib/lessonNotes";
import { watermarkText } from "@/lib/videoSecurity";
import {
  academyLessonForPack,
  copyForLang,
  notesForPack,
  scenesForPack,
  type VideoLessonPack,
} from "@/lib/videoLessons";

/** Page chrome in the UI locale (RTL for ar) around an EN/FR video lesson; the video, board and notes stay LTR. */
export function LessonWatchView({
  pack,
  watermarkName,
}: {
  pack: VideoLessonPack;
  watermarkName?: string;
}) {
  const { locale, m } = useI18n();
  const t = useNs(lessonsMessages);
  const [lang, setLang] = useState<LessonLang>(locale || DEFAULT_LESSON_LANG);
  const lesson = academyLessonForPack(pack) ?? getAcademyLesson(pack.lessonId);
  const copy = copyForLang(pack, lang);
  const watermark = watermarkText(watermarkName ?? m.result.watermarkGuest, "76532421");
  const changeLanguage = (next: LessonLang) => {
    setLang(next);
    void saveLocale(next);
  };

  return (
    <main className="shell mm-watch">
      <p className="eyebrow">{copy.trackLabel}</p>
      <h1>{copy.title}</h1>
      <p className="muted">
        {locale === "ar" ? (
          <>
            <Ltr>{copy.title}</Ltr> ·{" "}
          </>
        ) : null}
        {t.watchLead}
      </p>
      <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
        <LessonVideoPlayer
          videoUrl={pack.videoEn}
          videoUrlFr={pack.videoFr}
          heading={`${copy.trackLabel} · ${copy.title}`}
          scenes={scenesForPack(pack, lang, lesson)}
          scenesFr={pack.fallbackFr}
          watermark={watermark}
          lang={lang}
          onLangChange={changeLanguage}
        />
        <LessonNotes blocks={notesForPack(pack, lang)} dir="ltr" />
      </div>
      <article className="card" style={{ marginTop: 24 }}>
        <h3>{t.afterTitle}</h3>
        <p className="muted">{t.afterLead}</p>
        <div className="row">
          <Link href={pack.practiceHref} className="btn dark">
            {t.practice}
          </Link>
          <Link href={pack.contestHref} className="btn">
            {t.contest}
          </Link>
          <Link href={`/classroom/${pack.lessonId}`} className="ghost-btn ink">
            {t.classPage}
          </Link>
        </div>
      </article>
    </main>
  );
}
