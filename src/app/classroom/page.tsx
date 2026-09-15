"use client";

import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import { isLessonUnlocked, trackProgressPercent } from "@/lib/gating";
import type { ProgressEntry, StoreData } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ClassroomIndexPage() {
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  useEffect(() => {
    void fetch("/api/content")
      .then((response) => response.json())
      .then((store: StoreData) => setProgress(store.progress ?? []));
  }, []);

  return (
    <main className="shell">
      <p className="eyebrow">Classroom studio</p>
      <h1>Every grade. Every chapter. Professor at the board.</h1>
      <p className="muted">افتح الدرس ثم الاختبار. الدرس التالي يُفتح بعد 70%.</p>
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
                  const open = isLessonUnlocked(lesson.id, progress);
                  return open ? (
                    <Link key={lesson.id} href={`/classroom/${lesson.id}`} className="card" style={{ margin: 0 }}>
                      <span className="badge">Chapter {lesson.chapter}</span>
                      <h3>{lesson.title}</h3>
                    </Link>
                  ) : (
                    <div key={lesson.id} className="card" style={{ margin: 0, opacity: 0.55 }}>
                      <span className="badge">مقفل</span>
                      <h3>{lesson.title}</h3>
                      <p className="muted">اجتز اختبار الفصل السابق أولاً</p>
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
