"use client";

import { SAMPLE_QUESTIONS } from "@/lib/solver/demoSolver";
import { Katex } from "@/components/studio/Katex";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { useCurriculum } from "@/components/curriculum/CurriculumProvider";
import { Icon } from "@/components/ui/Icon";

type SolveMathResponse = {
  ok?: boolean;
  id?: string;
  resultPath?: string;
  error?: string;
  errorAr?: string;
};

const SOLVER_TRACKS: CertificateTrack[] = ["brevet", "ls", "gs", "se", "sat", "lh", "eb7", "eb8", "s1", "university"];

/** Exam systems whose answer-writing style the solver reproduces ("auto" = detect from the question). */
const CURRICULUM_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "auto", label: "Auto-detect" },
  { id: "lebanese", label: "Lebanese official (Brevet / GS / LS / SE / LH)" },
  { id: "french_bac", label: "French Bac" },
  { id: "ib", label: "IB (AA / AI, SL / HL)" },
  { id: "ap", label: "AP Calculus AB / BC" },
  { id: "sat_act", label: "SAT / ACT" },
  { id: "cambridge", label: "IGCSE / A Level" },
  { id: "university", label: "University" },
];

function asSolverTrack(value: string | undefined): CertificateTrack | undefined {
  if (!value) return undefined;
  return SOLVER_TRACKS.includes(value as CertificateTrack) ? (value as CertificateTrack) : undefined;
}

export function MathSolverForm() {
  const router = useRouter();
  const { solverTrack, curriculumId, ready } = useCurriculum();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [latex, setLatex] = useState("");
  const [advanced, setAdvanced] = useState(false);
  // Solutions default to English; Arabic / French only when the student picks them.
  const [language, setLanguage] = useState<LessonLanguage>("en");
  const [solverCurriculum, setSolverCurriculum] = useState("auto");
  const [track, setTrack] = useState<CertificateTrack>("brevet");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorAr, setErrorAr] = useState("");

  useEffect(() => {
    if (!ready) return;
    const mapped = asSolverTrack(solverTrack);
    if (mapped) setTrack(mapped);
  }, [ready, solverTrack]);

  const pickFile = (next: File | null) => {
    setFile(next);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : null);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    setErrorAr("");
    try {
      const form = new FormData();
      form.set("question", question);
      form.set("latex", latex);
      form.set("language", language);
      form.set("track", track);
      form.set("curriculum", solverCurriculum);
      form.set("platformCurriculum", curriculumId);
      if (file) form.set("image", file);
      const response = await fetch("/api/solve-math", { method: "POST", body: form, credentials: "same-origin" });
      const payload = (await response.json()) as SolveMathResponse;
      if (!response.ok || !payload.ok || !payload.id) {
        setError("");
        setErrorAr(payload.errorAr ?? "تعذّر حل المسألة الآن. حاول مجدداً بعد قليل.");
        setBusy(false);
        return;
      }
      router.push(payload.resultPath || `/math-solver/result/${payload.id}`);
    } catch {
      setError("");
      setErrorAr("تعذّر الاتصال. تحقّق من الإنترنت وحاول مجدداً.");
      setBusy(false);
    }
  };

  const empty = !question.trim() && !latex.trim() && !file;

  return (
    <div className="solver-form mm-mobile-stack">
      <div className="mm-solver-photo">
        <button type="button" className="btn dark mm-btn-lg" onClick={() => cameraRef.current?.click()}>
          <Icon name="camera" size={20} /> صوّر المسألة
        </button>
        <button type="button" className="ghost-btn ink mm-btn-lg" onClick={() => fileRef.current?.click()}>
          ارفع صورة
        </button>
        {file ? (
          <button type="button" className="ghost-btn ink" onClick={() => pickFile(null)}>
            إزالة الصورة
          </button>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => pickFile(event.target.files?.[0] ?? null)} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
      />
      {preview ? <img className="question-image" src={preview} alt="صورة المسألة" /> : null}

      <label className="mm-field">
        <span>أو اكتب المسألة</span>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          dir="auto"
          placeholder="اكتب نص المسألة هنا…"
        />
      </label>

      <div className="mm-solver-samples">
        <span className="muted">أمثلة سريعة:</span>
        <div className="row sample-chips">
          {SAMPLE_QUESTIONS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="chip"
              aria-label={sample.label}
              onClick={() => {
                setQuestion(sample.question);
                setLatex(formatLebaneseEquation(sample.tex));
                setTrack(sample.track);
              }}
            >
              <Katex tex={sample.tex} />
            </button>
          ))}
        </div>
      </div>

      {latex ? (
        <p className="latex-preview">
          <Katex tex={latex} display />
        </p>
      ) : null}

      <div className="grid two">
        <label className="mm-field">
          <span>لغة الحل</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as LessonLanguage)}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
          </select>
        </label>
        <label className="mm-field">
          <span>المسار</span>
          <select value={track} onChange={(event) => setTrack(event.target.value as CertificateTrack)} dir="ltr">
            <option value="brevet">Brevet</option>
            <option value="ls">Terminale LS</option>
            <option value="gs">Terminale GS</option>
            <option value="se">Terminale SE</option>
            <option value="sat">SAT</option>
            <option value="lh">LH</option>
            <option value="university">University / جامعي</option>
          </select>
        </label>
        <label className="mm-field">
          <span>المنهج / Curriculum</span>
          <select value={solverCurriculum} onChange={(event) => setSolverCurriculum(event.target.value)} dir="ltr">
            {CURRICULUM_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="mm-solver-advanced" open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}>
        <summary>متقدّم: كتابة المعادلة بصيغة LaTeX</summary>
        <label className="mm-field">
          <span>
            صيغة <bdi dir="ltr">LaTeX</bdi> (اختياري)
          </span>
          <input value={latex} onChange={(event) => setLatex(formatLebaneseEquation(event.target.value))} dir="ltr" />
        </label>
      </details>

      <p className="muted mm-solver-note">
        يتبع الحل تسلسل الامتحان الرسمي: مجال التعريف، النهايات، جدول التغيّرات، ثم الجواب النهائي في إطار. إذا كانت
        الصورة غير واضحة سنطلب منك إعادة التصوير بدل تخمين المسألة.
      </p>
      <ApiErrorBanner error={error} errorAr={errorAr} />
      {busy ? (
        <div className="solver-submit-skeleton" aria-busy="true" style={{ marginTop: 12 }}>
          <SkeletonBlock lines={3} label="جارٍ الحل…" />
        </div>
      ) : null}
      <button className="btn dark mm-btn-lg" type="button" disabled={busy || empty} onClick={() => void submit()}>
        {busy ? "جارٍ الحل…" : "حلّ المسألة"}
      </button>
    </div>
  );
}
