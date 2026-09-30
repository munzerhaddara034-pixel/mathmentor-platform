"use client";

import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import { isLessonUnlocked, trackProgressPercent } from "@/lib/gating";
import type { ProgressEntry, StoreData } from "@/lib/types";
import { featuredWatchCards } from "@/lib/videoLessons";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { classroomMessages } from "@/lib/i18n/ns/classroom";
import { pickTitle } from "@/lib/i18n/pick";
import { useEffect, useState } from "react";

export default function ClassroomIndexPage() {
  const { locale } = useI18n();
  const t = classroomMessages[locale].index;
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/content");
        const store = (await response.json()) as StoreData;
        if (!cancelled) setProgress(store.progress ?? []);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>
      {loadError ? (
        <p className="error" role="alert">
          {t.loadFailed}
        </p>
      ) : null}
      <div className="row">
        <Link href="/lessons/interactive" className="btn dark">
          {t.player}
        </Link>
        <Link href="/studio/script" className="btn">
          {t.script}
        </Link>
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>{t.watch}</h2>
        <p className="muted">{t.watchLead}</p>
        <div className="grid two">
          {featuredWatchCards().map((card) => (
            <Link key={card.href} href={card.href} className="card" style={{ margin: 0 }}>
              {card.bilingual ? <span className="badge approved">EN | FR</span> : <span className="badge approved">{t.video}</span>}
              <h3>{locale === "fr" ? card.titleFr || card.titleEn : card.titleEn}</h3>
            </Link>
          ))}
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
            <p className="muted">{fmt(t.progress, { n: percent })}</p>
            <div className="grid two">
              {academyLessons
                .filter((lesson) => lesson.track === group.track)
                .map((lesson) => {
                  const open = isLessonUnlocked(lesson.id, progress);
                  return open ? (
                    <Link key={lesson.id} href={`/classroom/${lesson.id}`} className="card" style={{ margin: 0 }}>
                      <span className="badge">{fmt(t.chapter, { n: lesson.chapter })}</span>
                      {lesson.videoUrlFr ? <span className="badge approved">EN | FR</span> : lesson.videoUrl ? <span className="badge approved">{t.video}</span> : null}
                      <h3>{pickTitle(locale, lesson)}</h3>
                    </Link>
                  ) : (
                    <div key={lesson.id} className="card" style={{ margin: 0, opacity: 0.55 }}>
                      <span className="badge">{t.locked}</span>
                      <h3>{pickTitle(locale, lesson)}</h3>
                      <p className="muted">{t.lockedHint}</p>
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
