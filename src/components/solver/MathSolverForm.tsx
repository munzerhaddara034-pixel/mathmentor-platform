"use client";

import { SAMPLE_QUESTIONS } from "@/lib/solver/demoSolver";
import { Katex } from "@/components/studio/Katex";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function MathSolverForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("Solve x^2 - 5x + 6 = 0");
  const [latex, setLatex] = useState("x^2-5x+6=0");
  const [language, setLanguage] = useState("en");
  const [track, setTrack] = useState("brevet");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorAr, setErrorAr] = useState("");

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
      if (file) form.set("image", file);
      const response = await fetch("/api/solve-math", { method: "POST", body: form, credentials: "same-origin" });
      const payload = (await response.json()) as {
        ok?: boolean;
        id?: string;
        resultPath?: string;
        error?: string;
        errorAr?: string;
      };
      if (!response.ok || !payload.ok || !payload.id) {
        setError(payload.error ?? "Could not solve.");
        setErrorAr(payload.errorAr ?? "تعذّر الحل.");
        setBusy(false);
        return;
      }
      router.push(payload.resultPath || `/math-solver/result/${payload.id}`);
    } catch {
      setError("Network error.");
      setErrorAr("خطأ في الشبكة.");
      setBusy(false);
    }
  };

  return (
    <div className="solver-form">
      <div className="row sample-chips">
        {SAMPLE_QUESTIONS.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className="chip"
            onClick={() => {
              setQuestion(sample.question);
              setLatex(sample.question.replace(/Solve |Compute |Let /g, ""));
              setTrack(sample.track);
            }}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <label>
        Question / السؤال
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} />
      </label>
      <label>
        LaTeX (optional)
        <input value={latex} onChange={(event) => setLatex(event.target.value)} dir="ltr" />
      </label>
      {latex ? (
        <p className="latex-preview">
          <Katex tex={latex} display />
        </p>
      ) : null}
      <div className="grid two">
        <label>
          Language
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <label>
          Track
          <select value={track} onChange={(event) => setTrack(event.target.value)}>
            <option value="brevet">Brevet</option>
            <option value="ls">Terminale LS</option>
            <option value="gs">Terminale GS</option>
            <option value="se">Terminale SE</option>
            <option value="sat">SAT</option>
            <option value="lh">LH</option>
          </select>
        </label>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Upload image
        </button>
        <button type="button" className="btn" onClick={() => cameraRef.current?.click()}>
          Camera
        </button>
        {file ? (
          <button type="button" className="ghost" onClick={() => pickFile(null)}>
            Clear photo
          </button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
      />
      {preview ? <img className="question-image" src={preview} alt="Uploaded problem" /> : null}
      <p className="muted">
        Without <code>GEMINI_API_KEY</code> the demo solver covers Brevet/Terminale patterns (quadratics, limits,
        <code> (x-1)e^x </code>, systems, Pythagoras). With a key, Gemini Vision reads photos.
      </p>
      {error ? (
        <div className="studio-teacher-error" role="alert">
          <p>{error}</p>
          <p dir="rtl" lang="ar">
            {errorAr}
          </p>
        </div>
      ) : null}
      <button className="btn dark" type="button" disabled={busy} onClick={() => void submit()}>
        {busy ? "Solving…" : "Solve with Prof. Munzer AI"}
      </button>
    </div>
  );
}
