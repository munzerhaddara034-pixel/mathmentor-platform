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
      else submitted.current = false;
    } catch {
      submitted.current = false;
    } finally {
      setBusy(false);
    }
  };

  if (busy && !result) {
    return (
      <section className="exam-sim relative-watermark">
        <PageWatermark name={student.name} phone={student.phone} />
        <p className="eyebrow">AI barème · جاري التصحيح</p>
        <h2>Grading against the official mark distribution…</h2>
        <SkeletonBlock lines={6} label="Grading exam…" />
      </section>
    );
  }

  if (result) {
    const grading = result.attempt.grading;
    return (
      <section className="exam-sim relative-watermark">
        <PageWatermark name={student.name} phone={student.phone} />
        <div className={`result-hero ${grading.percent >= 50 ? "pass" : "fail"}`}>
          <p className="eyebrow">Barème · {grading.source} grader · سلّم التصحيح</p>
          <h2>
            {grading.totalAwarded} / {grading.totalMax}
          </h2>
          <p>
            {grading.percent}% · {grading.summary}
          </p>
          <p className="muted" dir="rtl">
            {grading.summaryAr}
          </p>
          <p className="muted">
            Sum of sub-max = {baremeSummary.totalMarks} · {baremeSummary.subCount} graded items · Prof. Munzer
            Haddara / الأستاذ منذر حداره
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
                    <p>{grade?.comment}</p>
                    <p className="muted" dir="rtl">
                      {grade?.commentAr}
                    </p>
                    <p className="muted">Your answer: {answers[sub.id] || "—"}</p>
                  </div>
                );
              })}
            </article>
          )),
        )}
        <div className="row" style={{ marginTop: 16, flexWrap: "wrap", gap: 8 }}>
          <a className="btn dark" href={result.reportUrl}>
            Download PDF report
          </a>
          <a className="btn" href={`${result.reportUrl}?format=html`} target="_blank" rel="noreferrer">
            Open HTML report
          </a>
        </div>
        {isSat ? (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Practice more · على نسقه</h3>
            <p className="muted">Generate new SAT-style items in the same patterns as this paper.</p>
            <GenerateSimilarPanel paperId={paper.id} label="Generate similar set (على نسقه)" />
          </div>
        ) : null}
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
          <p className="muted">
            Official barème visible · {paper.totalMarks} pts total · Prof. Munzer Haddara
          </p>
        </div>
        <div className="exam-clock" aria-live="polite">
          {clock}
        </div>
        <FormulaDrawer />
      </div>
      {isSat ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            SAT Math demo · MCQ (A–D) and student-produced response (SPR). Use{" "}
            <strong>Generate similar (على نسقه)</strong> under any question for new items in the same skill.
          </p>
          <GenerateSimilarPanel paperId={paper.id} label="Generate similar set for whole paper" />
        </div>
      ) : (
        <div className="card mm-bareme-intro" style={{ marginBottom: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            Each sub-question shows the <strong>official Barème / سلّم التصحيح</strong> (points per step). Add the
            step marks to check your total before you submit.
          </p>
        </div>
      )}
      {paper.parts.map((part) => (
        <section key={part.id} className="card exam-part">
          <h3>
            {part.roman}. {part.title}
          </h3>
          <p className="muted" dir="rtl">
            {part.titleAr}
          </p>
          {part.questions.map((question) => (
            <article key={question.id} className="exam-question mm-exam-q-grid">
              <div className="mm-exam-q-main">
                <h4>
                  Question {question.number}
                  {question.title ? ` — ${question.title}` : ""}
                </h4>
                {question.prompt ? (
                  <p>
                    <MixedMathText text={question.prompt} />
                  </p>
                ) : null}
                {question.promptAr && !isSat ? (
                  <p className="muted" dir="rtl">
                    <MixedMathText text={question.promptAr} />
                  </p>
                ) : null}
                {question.subs.map((sub) => {
                  const responseType = sub.responseType ?? (sub.choices?.length ? "mcq" : "open");
                  const isMcq = responseType === "mcq" && Boolean(sub.choices?.length);
                  return (
                    <div key={sub.id} className="exam-sub">
                      <p>
                        <strong>{sub.label}.</strong> <MixedMathText text={sub.prompt} />{" "}
                        <span className="badge">
                          {sub.marks} pts
                          {responseType === "spr" ? " · SPR" : isMcq ? " · MCQ" : ""}
                        </span>
                      </p>
                      {sub.promptAr && !isSat ? (
                        <p className="muted" dir="rtl">
                          <MixedMathText text={sub.promptAr} />
                        </p>
                      ) : null}
                      {sub.latex ? <Katex tex={sub.latex} display /> : null}
                      <BaremeAside sub={sub} compact />
                      {isMcq && sub.choices ? (
                        <fieldset style={{ border: "none", padding: 0, margin: "8px 0" }}>
                          <legend className="sr-only">Choices for {sub.label}</legend>
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
                            responseType === "spr"
                              ? "Student-produced response (number or expression)…"
                              : "Write the official-style answer…"
                          }
                        />
                      )}
                      {isSat ? (
                        <GenerateSimilarPanel
                          paperId={paper.id}
                          questionId={sub.id}
                          label={`Similar to Q${sub.label} (على نسقه)`}
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
      <button className="btn dark" type="button" disabled={busy} onClick={() => void submit()}>
        {busy ? "Grading…" : "Submit for AI grading / إرسال للتصحيح"}
      </button>
    </section>
  );
}
