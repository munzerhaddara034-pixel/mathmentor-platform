"use client";

import { LessonNotes } from "@/components/LessonNotes";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { classroomScenes, getAcademyLesson } from "@/lib/academyLessons";
import { GRADE_12_LS_LIMITS_LESSON_ID, GRADE_12_LS_LIMITS_VIDEO_URL, grade12LsLimitsNotes } from "@/lib/grade12LsLimits";
import { grade12LsCh1Scenes } from "@/lib/grade12LsCh1";
import Link from "next/link";

export default function Grade12LsChapter1Page() {
  const lesson = getAcademyLesson(GRADE_12_LS_LIMITS_LESSON_ID);
  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">صف 12 · علوم الحياة</p>
      <h1>وحدة النهايات</h1>
      <p className="muted">
        فيديو شرح حقيقي (أسلوب صف: افتتاح، فكرة واحدة، مثال محلول، خطأ شائع، خلاصة) ثم الملخص العربي وبنك الأسئلة.
        لا يوجد ادّعاء أن كل دروس الصفوف الأخرى مصوّرة بعد.
      </p>
      <LessonVideoPlayer
        videoUrl={lesson?.videoUrl ?? GRADE_12_LS_LIMITS_VIDEO_URL}
        heading="صف 12 علوم الحياة · النهايات"
        scenes={lesson ? classroomScenes(lesson) : grade12LsCh1Scenes}
        watermark="طالب المنصة · 76532421"
      />
      <LessonNotes blocks={grade12LsLimitsNotes} />
      <article className="card" style={{ marginTop: 24 }}>
        <h3>بعد هذا الفيديو</h3>
        <p className="muted">
          تدريب النهايات، أو مسابقة المسألة الرابعة (دراسة الدوال: نهاية، استمرار، مشتقة، جدول تغيرات، تقارب، دالة عكسية) مرتّبة سهل فمتوسط فصعب. البنود بأسلوب النماذج وليست نسخاً من دورة رسمية.
        </p>
        <div className="row">
          <Link href={`/practice/take?lessonId=${GRADE_12_LS_LIMITS_LESSON_ID}&mode=free`} className="btn dark">
            تدريب النهايات
          </Link>
          <Link href="/practice/take?bank=g12-ls-functions&mode=contest" className="btn">
            مسابقة الدوال
          </Link>
          <Link href={`/classroom/${GRADE_12_LS_LIMITS_LESSON_ID}`} className="btn">
            صفحة الصف
          </Link>
        </div>
      </article>
    </main>
  );
}
