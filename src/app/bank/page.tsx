"use client";

import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import { difficultyLabel } from "@/lib/quizBank";
import type { Difficulty, ExamPaper, GradeTrack, QuizKind, QuizQuestion } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export default function BankAdminPage() {
  const [track, setTrack] = useState<GradeTrack>("grade-12");
  const lessons = useMemo(() => academyLessons.filter((item) => item.track === track), [track]);
  const [lessonId, setLessonId] = useState("grade-12-ch1");
  const [kind, setKind] = useState<QuizKind>("mcq");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [prompt, setPrompt] = useState("");
  const [latex, setLatex] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState("أ\nب\nج\nد");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [steps, setSteps] = useState("");
  const [list, setList] = useState<QuizQuestion[]>([]);
  const [exams, setExams] = useState<ExamPaper[]>([]);
  const [examTitle, setExamTitle] = useState("اختبار شامل");
  const [duration, setDuration] = useState(20);
  const [passScore, setPassScore] = useState(70);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!lessons.some((item) => item.id === lessonId)) setLessonId(lessons[0]?.id ?? "");
  }, [lessons, lessonId]);

  const load = () => {
    void fetch("/api/questions")
      .then((response) => response.json())
      .then((data: { questions?: QuizQuestion[] }) => setList(data.questions ?? []));
    void fetch("/api/exams")
      .then((response) => response.json())
      .then((data: { exams?: ExamPaper[] }) => setExams(data.exams ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (kind === "tf") setOptions("صح\nخطأ");
  }, [kind]);

  const saveQuestion = async () => {
    const optionRows = options.split("\n").map((item) => item.trim()).filter(Boolean);
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
    const data = (await response.json()) as { error?: string };
    setStatus(data.error ?? "تم حفظ السؤال");
    load();
  };

  const saveExam = async () => {
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
    const data = (await response.json()) as { error?: string };
    setStatus(data.error ?? "تم إنشاء الاختبار الشامل");
    load();
  };

  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">لوحة الأستاذ</p>
      <h1>بنك الأسئلة والامتحانات</h1>
      <div className="grid two">
        <section className="card">
          <h2>إضافة سؤال</h2>
          <label>
            الصف
            <select value={track} onChange={(event) => setTrack(event.target.value as GradeTrack)}>
              {gradeGroups.map((group) => (
                <option key={group.track} value={group.track}>
                  {group.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            الدرس
            <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  Chapter {lesson.chapter} · {lesson.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            النوع
            <select value={kind} onChange={(event) => setKind(event.target.value as QuizKind)}>
              <option value="mcq">اختيار من متعدد</option>
              <option value="tf">صح / خطأ</option>
            </select>
          </label>
          <label>
            الصعوبة
            <select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value) as Difficulty)}>
              {([1, 2, 3, 4] as Difficulty[]).map((level) => (
                <option key={level} value={level}>
                  {difficultyLabel[level]}
                </option>
              ))}
            </select>
          </label>
          <label>
            نص السؤال
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>
          <label>
            معادلة LaTeX (اختياري)
            <input value={latex} onChange={(event) => setLatex(event.target.value)} placeholder="\\lim_{x\\to 0} x" />
          </label>
          <label>
            رابط صورة السؤال (اختياري)
            <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
          </label>
          <label>
            الخيارات (سطر لكل خيار)
            <textarea value={options} onChange={(event) => setOptions(event.target.value)} />
          </label>
          <label>
            رقم الإجابة الصحيحة (يبدأ من 0)
            <input type="number" value={correctIndex} onChange={(event) => setCorrectIndex(Number(event.target.value))} />
          </label>
          <label>
            خطوات الحل (سطر لكل خطوة)
            <textarea value={steps} onChange={(event) => setSteps(event.target.value)} />
          </label>
          <button className="btn dark" type="button" onClick={() => void saveQuestion()}>
            حفظ السؤال
          </button>
        </section>
        <section className="card">
          <h2>اختبار شامل</h2>
          <label>
            العنوان
            <input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} />
          </label>
          <label>
            المدة بالدقائق
            <input type="number" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
          </label>
          <label>
            درجة النجاح %
            <input type="number" value={passScore} onChange={(event) => setPassScore(Number(event.target.value))} />
          </label>
          <p className="muted">إن تُركت قائمة الأسئلة فارغة يُستخدم بنك الدرس المختار كاملاً.</p>
          <button className="btn ok" type="button" onClick={() => void saveExam()}>
            إنشاء الاختبار
          </button>
          {exams.map((exam) => (
            <p key={exam.id}>
              {exam.title} · {exam.durationMinutes} min · {exam.passScore}%
            </p>
          ))}
        </section>
      </div>
      {status ? <p className="success">{status}</p> : null}
      <section className="card" style={{ marginTop: 20 }}>
        <h2>الأسئلة المضافة</h2>
        {list.map((item) => (
          <p key={item.id}>
            {item.prompt} · {difficultyLabel[item.difficulty]} · {item.lessonId}
          </p>
        ))}
      </section>
    </main>
  );
}
