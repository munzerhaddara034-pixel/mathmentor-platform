"use client";

import { FormulaDrawer } from "@/components/exams/FormulaDrawer";
import { Katex } from "@/components/studio/Katex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import { PageWatermark } from "@/components/studio/IdentityWatermark";
import type { GradeResult, OfficialPaper } from "@/lib/exams/types";
import { useEffect, useMemo, useRef, useState } from "react";

export function ExamSimulator({
  paper,
  student,
}: {
  paper: OfficialPaper;
  student: { name: string; phone: string };
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(paper.durationMinutes * 60);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    attempt: { id: string; grading: GradeResult };
    reportUrl: string;
  } | null>(null);
  const started = useRef(Date.now());
  const submitted = useRef(false);

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

  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
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
    setBusy(false);
  };

  if (result) {
    const grading = result.attempt.grading;
    return (
      <section className="exam-sim relative-watermark">
        <PageWatermark name={student.name} phone={student.phone} />
        <div className={`result-hero ${grading.percent >= 50 ? "pass" : "fail"}`}>
          <p className="eyebrow">Barème · {grading.source} grader</p>
          <h2>
            {grading.totalAwarded} / {grading.totalMax}
          </h2>
          <p>
            {grading.percent}% · {grading.summary}
          </p>
        </div>
        {grading.subs.map((sub) => (
          <article className="card" key={sub.subId} style={{ marginTop: 12 }}>
            <span className={`badge ${sub.awarded >= sub.max ? "approved" : sub.awarded > 0 ? "pending" : "rejected"}`}>
              {sub.label} · {sub.awarded}/{sub.max}
            </span>
            <p>{sub.comment}</p>
            <p className="muted" dir="rtl">
              {sub.commentAr}
            </p>
            <p className="muted">Your answer: {answers[sub.subId] || "—"}</p>
          </article>
        ))}
        <div className="row" style={{ marginTop: 16 }}>
          <a className="btn dark" href={result.reportUrl}>
            Download PDF report
          </a>
          <a className="btn" href={`${result.reportUrl}?format=html`} target="_blank" rel="noreferrer">
            Open HTML report
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="exam-sim relative-watermark" dir="ltr">
      <PageWatermark name={student.name} phone={student.phone} />
      <div className="exam-toolbar">
        <div>
          <p className="eyebrow">{paper.sessionLabel}</p>
          <h2>{paper.title}</h2>
          <p dir="rtl">{paper.titleAr}</p>
        </div>
        <div className="exam-clock" aria-live="polite">
          {clock}
        </div>
        <FormulaDrawer />
      </div>
      {paper.parts.map((part) => (
        <section key={part.id} className="card exam-part">
          <h3>
            {part.roman}. {part.title}
          </h3>
          <p className="muted" dir="rtl">
            {part.titleAr}
          </p>
          {part.questions.map((question) => (
            <article key={question.id} className="exam-question">
              <h4>
                Question {question.number}
                {question.title ? ` — ${question.title}` : ""}
              </h4>
              {question.prompt ? (
                <p>
                  <MixedMathText text={question.prompt} />
                </p>
              ) : null}
              {question.promptAr ? (
                <p className="muted" dir="rtl">
                  <MixedMathText text={question.promptAr} />
                </p>
              ) : null}
              {question.subs.map((sub) => (
                <div key={sub.id} className="exam-sub">
                  <p>
                    <strong>{sub.label}.</strong> <MixedMathText text={sub.prompt} />{" "}
                    <span className="badge">{sub.marks} pts</span>
                  </p>
                  <p className="muted" dir="rtl">
                    <MixedMathText text={sub.promptAr} />
                  </p>
                  {sub.latex ? <Katex tex={sub.latex} display /> : null}
                  <textarea
                    value={answers[sub.id] ?? ""}
                    onChange={(event) => setAnswers((current) => ({ ...current, [sub.id]: event.target.value }))}
                    placeholder="Write the official-style answer…"
                  />
                </div>
              ))}
            </article>
          ))}
        </section>
      ))}
      <button className="btn dark" type="button" disabled={busy} onClick={() => void submit()}>
        {busy ? "Grading…" : "Submit for AI grading / إرسال للتصحيح"}
      </button>
    </section>
  );
}
