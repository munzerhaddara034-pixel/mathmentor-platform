"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { practiceMessages, type PracticeMessages } from "@/lib/i18n/ns/practice";
import { pickTitle } from "@/lib/i18n/pick";
import { groupTopicBankCards, listTopicBankCards } from "@/lib/topicBanks";
import type { ExamPaper, GradeTrack } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BankCardData = ReturnType<typeof listTopicBankCards>[number];
type ContestTopic = NonNullable<BankCardData["contestTopics"]>[number];

function topicTitle(locale: Locale, topic: ContestTopic): string {
  return locale === "ar" ? (topic.arabicTitle ?? topic.title) : topic.title;
}

export default function PracticeHubPage() {
  const { locale } = useI18n();
  const t = practiceMessages[locale].hub;
  const [track, setTrack] = useState<GradeTrack>("grade-12");
  const [lessonId, setLessonId] = useState("grade-12-ch1");
  const [exams, setExams] = useState<ExamPaper[]>([]);
  const [examsError, setExamsError] = useState(false);
  const grouped = groupTopicBankCards();

  const lessons = useMemo(() => academyLessons.filter((item) => item.track === track), [track]);

  useEffect(() => {
    if (!lessons.some((item) => item.id === lessonId)) setLessonId(lessons[0]?.id ?? "");
  }, [lessons, lessonId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/exams");
        const data = (await response.json().catch(() => ({}))) as { exams?: ExamPaper[] };
        if (!cancelled) setExams(data.exams ?? []);
      } catch {
        if (!cancelled) setExamsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = [
    { key: "ls", title: t.ls, lead: t.lsLead, cards: grouped.ls, first: true },
    { key: "se", title: t.se, lead: t.seLead, cards: grouped.se, first: false },
    { key: "gs", title: t.gs, lead: t.gsLead, cards: grouped.gs, first: false },
    { key: "brevet", title: t.brevet, lead: t.brevetLead, cards: grouped.brevet, first: false },
  ] as const;

  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>

      <section className="card" style={{ marginTop: 8 }}>
        <h2>{t.contests}</h2>
        <p className="muted">{t.contestsLead}</p>

        {sections.map((section) => (
          <div key={section.key}>
            <h3 style={{ marginTop: section.first ? 16 : 24 }}>{section.title}</h3>
            <p className="muted">{section.lead}</p>
            {section.cards[0]?.contestTopics?.map((topic) => (
              <p key={topic.id} className="muted" style={{ margin: "4px 0" }}>
                {topicTitle(locale, topic)}
                {topic.implemented ? t.thisBank : t.later}
              </p>
            ))}
            {section.cards.map((card) => (
              <BankCard key={card.id} card={card} locale={locale} t={t} />
            ))}
          </div>
        ))}
      </section>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>{t.single}</h2>
        <label>
          {t.track}
          <select value={track} onChange={(event) => setTrack(event.target.value as GradeTrack)}>
            {gradeGroups.map((group) => (
              <option key={group.track} value={group.track}>
                {group.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.lesson}
          <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {fmt(t.chapter, { n: lesson.chapter, title: pickTitle(locale, lesson) })}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <Link className="btn" href={`/practice/take?lessonId=${lessonId}&mode=free`}>
            {t.free}
          </Link>
          <Link className="btn dark" href={`/practice/take?lessonId=${lessonId}&mode=exam`}>
            {t.lessonExam}
          </Link>
        </div>
      </div>
      {examsError ? (
        <p className="error" role="alert" style={{ marginTop: 20 }}>
          {t.loadFailed}
        </p>
      ) : null}
      {exams.length ? (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>{t.teacherExams}</h2>
          {exams.map((exam) => (
            <p key={exam.id}>
              <Link href={`/practice/take?lessonId=${exam.lessonId || lessonId}&mode=exam&examId=${exam.id}`}>
                {fmt(t.examLine, { title: exam.title, min: exam.durationMinutes, pass: exam.passScore })}
              </Link>
            </p>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function BankCard({ card, locale, t }: { card: BankCardData; locale: Locale; t: PracticeMessages["hub"] }) {
  const blurb =
    card.id === "g12-ls-functions"
      ? t.blurbLsFunctions
      : card.certificate === "LS"
        ? t.blurbLs
        : card.certificate === "SE"
          ? t.blurbSe
          : card.certificate === "GS"
            ? t.blurbGs
            : card.certificate === "Brevet"
              ? t.blurbBrevet
              : null;
  const title = pickTitle(locale, card);
  return (
    <article className="card" style={{ marginTop: 12 }}>
      <span className="badge">{card.certificate}</span>
      <h3>
        {card.certificate} — {title}
      </h3>
      <p className="muted">
        {fmt(t.bankMeta, {
          n: card.questionCount,
          slices: card.slices.map((slice) => pickTitle(locale, slice)).join(" · "),
          min: card.contestMinutes,
        })}
      </p>
      {blurb ? <p className="muted">{blurb}</p> : null}
      <div className="row">
        <Link className="btn dark" href={`/practice/take?bank=${card.id}&mode=contest`}>
          {fmt(t.contest, { title })}
        </Link>
        <Link className="btn" href={`/practice/take?bank=${card.id}&mode=free`}>
          {t.wholeBank}
        </Link>
        {card.id === "g12-ls-functions" ? (
          <Link className="btn" href="/classroom/grade-12-ch1">
            {t.limitsVideo}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
