"use client";

import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { fmt } from "@/lib/i18n/format";
import { practiceMessages } from "@/lib/i18n/ns/practice";
import { pickTitle } from "@/lib/i18n/pick";
import type {
  Difficulty,
  ExamPaper,
  GradeTrack,
  QuizKind,
  QuizQuestion,
} from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function BankAdminPage() {
  const { locale } = useI18n();
  const t = practiceMessages[locale].bank;
  const difficultyLabel = practiceMessages[locale].difficulty;
  const [track, setTrack] = useState<GradeTrack>("grade-12");
  const lessons = useMemo(
    () => academyLessons.filter((item) => item.track === track),
    [track],
  );
  const [lessonId, setLessonId] = useState("grade-12-ch1");
  const [kind, setKind] = useState<QuizKind>("mcq");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [prompt, setPrompt] = useState("");
  const [latex, setLatex] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState<string>(t.optionsMcq);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [steps, setSteps] = useState("");
  const [list, setList] = useState<QuizQuestion[]>([]);
  const [exams, setExams] = useState<ExamPaper[]>([]);
  const [examTitle, setExamTitle] = useState<string>(t.defaultExamTitle);
  const [duration, setDuration] = useState(20);
  const [passScore, setPassScore] = useState(70);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lessons.some((item) => item.id === lessonId))
      setLessonId(lessons[0]?.id ?? "");
  }, [lessons, lessonId]);

  const load = useCallback(async () => {
    try {
      const [questionsRes, examsRes] = await Promise.all([
        fetch("/api/questions"),
        fetch("/api/exams"),
      ]);
      const questionsData = (await questionsRes.json().catch(() => ({}))) as {
        questions?: QuizQuestion[];
      };
      const examsData = (await examsRes.json().catch(() => ({}))) as {
        exams?: ExamPaper[];
      };
      setList(questionsData.questions ?? []);
      setExams(examsData.exams ?? []);
      setError("");
    } catch {
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (kind === "tf") setOptions(t.optionsTf);
  }, [kind, t]);

  const saveQuestion = async () => {
    const optionRows = options
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          kind,
          difficulty,
          prompt,
          latex,
          imageUrl,
          options: optionRows,
          correctIndex,
          steps: steps.split("\n").filter(Boolean),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setStatus(data.error ?? t.saved);
      void load();
    } catch {
      setStatus(t.network);
    }
  };

  const saveExam = async () => {
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: examTitle,
          arabicTitle: examTitle,
          track,
          lessonId,
          durationMinutes: duration,
          passScore,
          questionIds: [],
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setStatus(data.error ?? t.created);
      void load();
    } catch {
      setStatus(t.network);
    }
  };

  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid two">
        <section className="card">
          <h2>{t.add}</h2>
          <label>
            {t.grade}
            <select
              value={track}
              onChange={(event) => setTrack(event.target.value as GradeTrack)}
            >
              {gradeGroups.map((group) => (
                <option key={group.track} value={group.track}>
                  {group.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.lesson}
            <select
              value={lessonId}
              onChange={(event) => setLessonId(event.target.value)}
            >
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {fmt(practiceMessages[locale].hub.chapter, {
                    n: lesson.chapter,
                    title: pickTitle(locale, lesson),
                  })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.kind}
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as QuizKind)}
            >
              <option value="mcq">{t.mcq}</option>
              <option value="tf">{t.tf}</option>
            </select>
          </label>
          <label>
            {t.difficulty}
            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(Number(event.target.value) as Difficulty)
              }
            >
              {([1, 2, 3, 4] as Difficulty[]).map((level) => (
                <option key={level} value={level}>
                  {difficultyLabel[level]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.prompt}
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <label>
            {t.latex}
            <input
              value={latex}
              onChange={(event) => setLatex(event.target.value)}
              placeholder="\\lim_{x\\to 0} x"
              dir="ltr"
            />
          </label>
          <label>
            {t.image}
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              dir="ltr"
            />
          </label>
          <label>
            {t.options}
            <textarea
              value={options}
              onChange={(event) => setOptions(event.target.value)}
            />
          </label>
          <label>
            {t.correctIndex}
            <input
              type="number"
              value={correctIndex}
              onChange={(event) => setCorrectIndex(Number(event.target.value))}
            />
          </label>
          <label>
            {t.steps}
            <textarea
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
            />
          </label>
          <button
            className="btn dark"
            type="button"
            onClick={() => void saveQuestion()}
          >
            {t.save}
          </button>
        </section>
        <section className="card">
          <h2>{t.exam}</h2>
          <label>
            {t.examTitle}
            <input
              value={examTitle}
              onChange={(event) => setExamTitle(event.target.value)}
            />
          </label>
          <label>
            {t.duration}
            <input
              type="number"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            />
          </label>
          <label>
            {t.pass}
            <input
              type="number"
              value={passScore}
              onChange={(event) => setPassScore(Number(event.target.value))}
            />
          </label>
          <p className="muted">{t.emptyNote}</p>
          <button
            className="btn ok"
            type="button"
            onClick={() => void saveExam()}
          >
            {t.createExam}
          </button>
          {exams.map((exam) => (
            <p key={exam.id}>
              {fmt(t.examLine, {
                title: exam.title,
                min: exam.durationMinutes,
                pass: exam.passScore,
              })}
            </p>
          ))}
        </section>
      </div>
      {status ? <p className="success">{status}</p> : null}
      <section className="card" style={{ marginTop: 20 }}>
        <h2>{t.added}</h2>
        {loading ? <SkeletonBlock lines={3} label={t.loading} /> : null}
        {list.map((item) => (
          <p key={item.id} dir="auto">
            {item.prompt} · {difficultyLabel[item.difficulty]} · {item.lessonId}
          </p>
        ))}
      </section>
    </main>
  );
}
