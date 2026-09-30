"use client";

import { BaremeAside } from "@/components/exams/BaremeAside";
import { FormulaDrawer } from "@/components/exams/FormulaDrawer";
import { GenerateSimilarPanel } from "@/components/exams/GenerateSimilarPanel";
import { Katex } from "@/components/studio/Katex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import { PageWatermark } from "@/components/studio/IdentityWatermark";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { paperBaremeSummary } from "@/lib/exams/bareme";
import type { GradeResult, OfficialPaper, SubGrade } from "@/lib/exams/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { examsMessages } from "@/lib/i18n/ns/exams";
import { rich } from "@/lib/i18n/rich";

export function ExamSimulator({
  paper,
  student,
}: {
  paper: OfficialPaper;
  student: { name: string; phone: string };
}) {
  const { locale } = useI18n();
  const t = examsMessages[locale].sim;
  const isAr = locale === "ar";
  const [submitError, setSubmitError] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(paper.durationMinutes * 60);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    attempt: { id: string; grading: GradeResult };
    reportUrl: string;
  } | null>(null);
  const started = useRef(Date.now());
  const submitted = useRef(false);
  const isSat = paper.track === "sat";
  const baremeSummary = useMemo(() => paperBaremeSummary(paper), [paper]);

  useEffect(() => {
    if (result) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          void submit();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, paper.id]);

  const clock = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [secondsLeft]);

  const gradesBySub = useMemo(() => {
    if (!result) return undefined;
    const map: Record<string, SubGrade> = {};
    for (const sub of result.attempt.grading.subs) {
      map[sub.subId] = sub;
    }
    return map;
  }, [result]);

  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setSubmitError(false);
    try {
      const response = await fetch("/api/exams/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          paperId: paper.id,
          answers,
          elapsedSec: Math.round((Date.now() - started.current) / 1000),
        }),
      });
      const payload = (await response.json()) as typeof result & { error?: string };
      if (payload?.attempt) setResult({ attempt: payload.attempt, reportUrl: payload.reportUrl });
      else {
        submitted.current = false;
        setSubmitError(true);
      }
    } catch {
      submitted.current = false;
      setSubmitError(true);
    } finally {
      setBusy(false);
    }
  };

  if (busy && !result) {
    return (
      <section className="exam-sim relative-watermark">
        <PageWatermark name={student.name} phone={student.phone} />
        <p className="eyebrow">{t.grading}</p>
        <h2>{t.gradingTitle}</h2>
        <SkeletonBlock lines={6} label={t.gradingLabel} />
      </section>
    );
  }

  if (result) {
    const grading = result.attempt.grading;
    return (
      <section className="exam-sim relative-watermark">
        <PageWatermark name={student.name} phone={student.phone} />
        <div className={`result-hero ${grading.percent >= 50 ? "pass" : "fail"}`}>
          <p className="eyebrow">{fmt(t.resultEyebrow, { source: grading.source })}</p>
          <h2>
            {grading.totalAwarded} / {grading.totalMax}
          </h2>
          <p>
            {grading.percent}% · {isAr ? grading.summaryAr || grading.summary : grading.summary}
          </p>
          <p className="muted">
            {fmt(t.sumLine, { total: baremeSummary.totalMarks, count: baremeSummary.subCount })}
          </p>
        </div>
        {paper.parts.map((part) =>
          part.questions.map((question) => (
            <article className="card exam-question mm-bareme-result-card" key={question.id} style={{ marginTop: 12 }}>
              <h3>
                Q{question.number}
                {question.title ? ` — ${question.title}` : ""}
              </h3>
              <BaremeAside question={question} gradesBySub={gradesBySub} />
              {question.subs.map((sub) => {
                const grade = gradesBySub?.[sub.id];
                return (
                  <div key={sub.id} className="exam-sub">
                    <span
                      className={`badge ${
                        grade && grade.awarded >= grade.max
                          ? "approved"
                          : grade && grade.awarded > 0
                            ? "pending"
                            : "rejected"
                      }`}
                    >
                      {sub.label} · {grade?.awarded ?? 0}/{sub.marks}
                    </span>
                    <p>{isAr ? grade?.commentAr || grade?.comment : grade?.comment}</p>
                    <p className="muted">{fmt(t.yourAnswer, { v: answers[sub.id] || "—" })}</p>
                  </div>
                );
              })}
            </article>
          )),
        )}
        <div className="row" style={{ marginTop: 16, flexWrap: "wrap", gap: 8 }}>
          <a className="btn dark" href={result.reportUrl}>
            {t.pdf}
          </a>
          <a className="btn" href={`${result.reportUrl}?format=html`} target="_blank" rel="noreferrer">
            {t.html}
          </a>
        </div>
        {isSat ? (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>{t.practiceMore}</h3>
            <p className="muted">{t.practiceMoreLead}</p>
            <GenerateSimilarPanel paperId={paper.id} label={t.similarSet} />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="exam-sim relative-watermark">
      <PageWatermark name={student.name} phone={student.phone} />
      <div className="exam-toolbar">
        <div>
          <p className="eyebrow">{paper.sessionLabel}</p>
          <h2>{isAr ? paper.titleAr || paper.title : paper.title}</h2>
          <p className="muted">{fmt(t.visible, { pts: paper.totalMarks })}</p>
        </div>
        <div className="exam-clock" aria-live="polite">
          {clock}
        </div>
        <FormulaDrawer />
      </div>
      {isSat ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            {rich(t.satIntro, { similar: <strong>{examsMessages[locale].similar.default}</strong> })}
          </p>
          <GenerateSimilarPanel paperId={paper.id} label={t.similarWhole} />
        </div>
      ) : (
        <div className="card mm-bareme-intro" style={{ marginBottom: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            {rich(t.baremeIntro, { bareme: <strong>{t.baremeName}</strong> })}
          </p>
        </div>
      )}
      {paper.parts.map((part) => (
        <section key={part.id} className="card exam-part">
          <h3>
            {part.roman}. {isAr ? part.titleAr || part.title : part.title}
          </h3>
          {part.questions.map((question) => (
            <article key={question.id} className="exam-question mm-exam-q-grid">
              <div className="mm-exam-q-main">
                <h4>
                  {fmt(t.question, { n: question.number })}
                  {question.title ? ` — ${question.title}` : ""}
                </h4>
                {/* Paper content is authored en + ar: show the locale's variant (fr uses en; SAT is en-only). */}
                {(isAr && !isSat ? question.promptAr || question.prompt : question.prompt) ? (
                  <p>
                    <MixedMathText text={(isAr && !isSat ? question.promptAr || question.prompt : question.prompt) ?? ""} />
                  </p>
                ) : null}
                {question.subs.map((sub) => {
                  const responseType = sub.responseType ?? (sub.choices?.length ? "mcq" : "open");
                  const isMcq = responseType === "mcq" && Boolean(sub.choices?.length);
                  return (
                    <div key={sub.id} className="exam-sub">
                      <p>
                        <strong>{sub.label}.</strong>{" "}
                        <MixedMathText text={isAr && !isSat ? sub.promptAr || sub.prompt : sub.prompt} />{" "}
                        <span className="badge">
                          {fmt(t.pts, { n: sub.marks })}
                          {responseType === "spr" ? " · SPR" : isMcq ? " · MCQ" : ""}
                        </span>
                      </p>
                      {sub.latex ? <Katex tex={sub.latex} display /> : null}
                      <BaremeAside sub={sub} compact />
                      {isMcq && sub.choices ? (
                        <fieldset style={{ border: "none", padding: 0, margin: "8px 0" }}>
                          <legend className="sr-only">{fmt(t.choicesFor, { label: sub.label })}</legend>
                          {sub.choices.map((choice) => (
                            <label
                              key={choice.id}
                              style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}
                            >
                              <input
                                type="radio"
                                name={sub.id}
                                value={choice.id}
                                checked={(answers[sub.id] ?? "") === choice.id}
                                onChange={() =>
                                  setAnswers((current) => ({ ...current, [sub.id]: choice.id }))
                                }
                              />
                              <span>
                                <strong>{choice.id}.</strong> <MixedMathText text={choice.text} />
                                {choice.latex ? (
                                  <>
                                    {" "}
                                    <Katex tex={choice.latex} />
                                  </>
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </fieldset>
                      ) : (
                        <textarea
                          value={answers[sub.id] ?? ""}
                          onChange={(event) =>
                            setAnswers((current) => ({ ...current, [sub.id]: event.target.value }))
                          }
                          placeholder={
                            responseType === "spr" ? t.sprPlaceholder : t.openPlaceholder
                          }
                        />
                      )}
                      {isSat ? (
                        <GenerateSimilarPanel
                          paperId={paper.id}
                          questionId={sub.id}
                          label={fmt(t.similarTo, { label: sub.label })}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <BaremeAside question={question} />
            </article>
          ))}
        </section>
      ))}
      {submitError ? (
        <p className="error" role="alert">
          {t.submitFailed}
        </p>
      ) : null}
      <button className="btn dark" type="button" disabled={busy} onClick={() => void submit()}>
        {busy ? t.gradingBusy : t.submit}
      </button>
    </section>
  );
}
