"use client";

import { LessonNotes } from "@/components/LessonNotes";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { SecurePlayerShell } from "@/components/SecurePlayerShell";
import { getAcademyLesson } from "@/lib/academyLessons";
import { DEFAULT_LESSON_LANG, type LessonLang } from "@/lib/lessonNotes";
import {
  academyLessonForPack,
  copyForLang,
  notesForPack,
  scenesForPack,
  type VideoLessonPack,
} from "@/lib/videoLessons";
import Link from "next/link";
import { useState } from "react";

export function LessonWatchView({ pack }: { pack: VideoLessonPack }) {
  const [lang, setLang] = useState<LessonLang>(DEFAULT_LESSON_LANG);
  const lesson = academyLessonForPack(pack) ?? getAcademyLesson(pack.lessonId);
  const copy = copyForLang(pack, lang);

  return (
    <SecurePlayerShell lessonId={pack.lessonId}>
      {({ watermark }) => (
        <main className="shell" dir="ltr">
          <p className="eyebrow">{copy.trackLabel}</p>
          <h1>{copy.title}</h1>
          <p className="muted">
            {lang === "fr"
              ? "Vidéo de cours : accroche, une idée, exemple résolu, erreur fréquente, bilan. Un clic EN | FR change la voix et le tableau ensemble."
              : "Classroom video: hook, one idea, worked example, common mistake, recap. One EN | FR click switches voice and board together."}
          </p>
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
          <article className="card" style={{ marginTop: 24 }}>
            <h3>{lang === "fr" ? "Après cette vidéo" : "After this video"}</h3>
            <p className="muted">{copy.afterVideo}</p>
            <div className="row">
              <Link href={pack.practiceHref} className="btn dark">
                {copy.practice}
              </Link>
              <Link href={pack.contestHref} className="btn">
                {copy.contestLabel}
              </Link>
              <Link href={`/classroom/${pack.lessonId}`} className="btn">
                {copy.classroom}
              </Link>
            </div>
          </article>
        </main>
      )}
    </SecurePlayerShell>
  );
}
