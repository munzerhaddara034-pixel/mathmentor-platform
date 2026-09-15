"use client";

import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import { isLessonUnlocked, trackProgressPercent } from "@/lib/gating";
import type { ProgressEntry, StoreData } from "@/lib/types";
import { featuredWatchCards } from "@/lib/videoLessons";
import { canAccessLesson, isPreviewLesson } from "@/lib/access";
import { useWatchAccess } from "@/components/SecurePlayerShell";
import { RedeemButton } from "@/components/RedeemModal";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ClassroomIndexPage() {
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const { user, entitlements, progress: authProgress } = useWatchAccess();

  useEffect(() => {
    void fetch("/api/content")
      .then((response) => response.json())
      .then((store: StoreData) => setProgress(store.progress ?? []));
  }, []);

  return (
    <main className="shell" dir="ltr">
      <p className="eyebrow">Classroom studio</p>
      <h1>Every grade. Every chapter. Professor at the board.</h1>
      <p className="muted">
        Chapter 1 of each grade is a free preview. Premium chapters unlock with a 12-character card on your student
        account. Bilingual videos use one EN | FR click for voice and board together.
      </p>
      <div className="row">
        <RedeemButton label="تفعيل كود" />
        <Link className="btn" href="/redeem">
          صفحة التفعيل
        </Link>
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>Watch now</h2>
        <p className="muted">Professor Munzer on camera. English default, French toggle on the new explainers.</p>
        <div className="grid two">
          {featuredWatchCards().map((card) => {
            const lesson = academyLessons.find((item) => item.id === card.lessonId);
            const open = !lesson || canAccessLesson(lesson, entitlements, user?.role);
            return open ? (
              <Link key={card.href} href={card.href} className="card" style={{ margin: 0 }}>
                {card.bilingual ? <span className="badge approved">EN | FR</span> : <span className="badge approved">Video</span>}
                <h3>{card.titleEn}</h3>
                <p className="muted">{card.titleFr}</p>
              </Link>
            ) : (
              <div key={card.href} className="card" style={{ margin: 0, opacity: 0.7 }}>
                <span className="badge">مقفلة</span>
                <h3>{card.titleEn}</h3>
                <p className="muted">فعّل كود الصف أو الوحدة لفتح هذا الفيديو.</p>
              </div>
            );
          })}
        </div>
      </section>
      {gradeGroups.map((group) => {
        const percent = trackProgressPercent(group.track, progress);
        return (
          <section key={group.track} className="card" style={{ marginTop: 20 }}>
            <h2>{group.title}</h2>
            <div className="progress-track">
              <span style={{ width: `${percent}%` }} />
            </div>
            <p className="muted">إنجاز المادة: {percent}%</p>
            <div className="grid two">
              {academyLessons
                .filter((lesson) => lesson.track === group.track)
                .map((lesson) => {
                  const quizOpen = isLessonUnlocked(lesson.id, authProgress.length ? authProgress : progress);
                  const entitled = canAccessLesson(lesson, entitlements, user?.role);
                  const open = quizOpen && entitled;
                  return open ? (
                    <Link key={lesson.id} href={`/classroom/${lesson.id}`} className="card" style={{ margin: 0 }}>
                      <span className="badge">Chapter {lesson.chapter}</span>
                      {isPreviewLesson(lesson) ? <span className="badge approved">معاينة</span> : null}
                      {lesson.videoUrlFr ? (
                        <span className="badge approved">EN | FR</span>
                      ) : lesson.videoUrl ? (
                        <span className="badge approved">فيديو</span>
                      ) : null}
                      <h3>{lesson.arabicTitle || lesson.title}</h3>
                      <p className="muted">{lesson.title}</p>
                    </Link>
                  ) : (
                    <div key={lesson.id} className="card" style={{ margin: 0, opacity: 0.55 }}>
                      <span className="badge">{!quizOpen ? "مقفل بالاختبار" : "يحتاج كود"}</span>
                      <h3>{lesson.title}</h3>
                      <p className="muted">
                        {!quizOpen ? "اجتز اختبار الفصل السابق أولاً" : "فعّل بطاقة الصف أو الوحدة لفتح هذا الفصل"}
                      </p>
                    </div>
                  );
                })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
