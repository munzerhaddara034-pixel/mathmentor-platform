"use client";

import Link from "next/link";
import { useState } from "react";
import { LessonNotes } from "@/components/LessonNotes";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { Ltr } from "@/components/ui/Ltr";
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

/** Arabic (RTL) page chrome around an EN/FR video lesson; the video, board and notes stay LTR. */
export function LessonWatchView({
  pack,
  watermarkName = "طالب المنصة",
}: {
  pack: VideoLessonPack;
  watermarkName?: string;
}) {
  const [lang, setLang] = useState<LessonLang>(DEFAULT_LESSON_LANG);
  const lesson = academyLessonForPack(pack) ?? getAcademyLesson(pack.lessonId);
  const copy = copyForLang(pack, lang);
  const watermark = watermarkText(watermarkName, "76532421");

  return (
    <main className="shell mm-watch" dir="rtl" lang="ar">
      <p className="eyebrow">{pack.trackLabelAr}</p>
      <h1>{pack.titleAr}</h1>
      <p className="muted">
        <Ltr>{copy.title}</Ltr> · فيديو صفّي: مدخل، فكرة واحدة، مثال محلول، خطأ شائع، وخلاصة. بدّل بين الإنكليزية
        والفرنسية بنقرة واحدة.
      </p>
      <div dir="ltr" lang={lang}>
        <LessonVideoPlayer
          videoUrl={pack.videoEn}
          videoUrlFr={pack.videoFr}
          heading={`${copy.trackLabel} · ${copy.title}`}
          scenes={scenesForPack(pack, lang, lesson)}
          scenesFr={pack.fallbackFr}
          watermark={watermark}
          lang={lang}
          onLangChange={setLang}
        />
        <LessonNotes blocks={notesForPack(pack, lang)} dir="ltr" />
      </div>
      <article className="card" style={{ marginTop: 24 }}>
        <h3>بعد هذا الفيديو</h3>
        <p className="muted">أعد قراءة ما على اللوح، ثم انتقل إلى التدريب أو المسابقة.</p>
        <div className="row">
          <Link href={pack.practiceHref} className="btn dark">
            تدرّب على الدرس
          </Link>
          <Link href={pack.contestHref} className="btn">
            المسابقة
          </Link>
          <Link href={`/classroom/${pack.lessonId}`} className="ghost-btn ink">
            صفحة الصف
          </Link>
        </div>
      </article>
    </main>
  );
}
