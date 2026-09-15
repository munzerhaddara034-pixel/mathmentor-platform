import { academyLessons } from "@/lib/academyLessons";
import { LessonNotes } from "@/components/LessonNotes";
import { ProtectedDocument } from "@/components/ProtectedDocument";
import { GRADE_12_LS_LIMITS_LESSON_ID, grade12LsLimitsNotes } from "@/lib/grade12LsLimits";
import { isLessonLang } from "@/lib/lessonNotes";
import { getVideoLessonPack, notesForPack } from "@/lib/videoLessons";
import { watermarkText } from "@/lib/videoSecurity";
import { notFound } from "next/navigation";

export default async function PrintResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang: langParam } = await searchParams;
  const lesson = academyLessons.find((item) => item.id === id);
  if (!lesson) notFound();
  const isLimitsPilot = lesson.id === GRADE_12_LS_LIMITS_LESSON_ID;
  const pack = getVideoLessonPack(lesson.id);
  const lang = isLessonLang(langParam) ? langParam : "en";
  const dir = pack || !isLimitsPilot ? "ltr" : "rtl";
  return (
    <ProtectedDocument watermark={watermarkText("Student view")}>
      <main className="shell print-sheet" dir={dir}>
        <p className="eyebrow">Protected view · academy notes, not a textbook scan</p>
        <h1>
          {lesson.gradeLabel} · {pack ? (lang === "fr" ? pack.titleFr : pack.titleEn) : lesson.arabicTitle || lesson.title}
        </h1>
        <p className="muted">On-platform view. Printing carries a watermark. Direct file download is not offered.</p>
        {pack ? (
          <LessonNotes blocks={notesForPack(pack, lang)} dir="ltr" />
        ) : isLimitsPilot ? (
          <LessonNotes blocks={grade12LsLimitsNotes} dir="rtl" />
        ) : (
          <section className="paper">
            <h2>Idea</h2>
            <p>{lesson.idea}</p>
            <h2>Rule</h2>
            <pre>{lesson.board}</pre>
            <h2>Worked example</h2>
            <ol>
              <li>Given: {lesson.example}</li>
              <li>Apply the rule above.</li>
              <li>Result: {lesson.exampleBoard}</li>
              <li>Check by substitution when possible.</li>
            </ol>
          </section>
        )}
      </main>
    </ProtectedDocument>
  );
}
