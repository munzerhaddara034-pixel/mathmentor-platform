"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCurriculum } from "@/components/curriculum/CurriculumProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";
import { TutorOrb } from "@/components/v2/TutorOrb";
import { MotionProvider } from "@/components/v2/motion/MotionProvider";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";
import { SOLVER_CURRICULUM_CHOICES, type SolverCurriculumChoice } from "./curriculumChoices";

/** KaTeX JS only loads if the student opens the LaTeX option (samples are server-rendered). */
const Katex = dynamic(() => import("@/components/studio/Katex").then((mod) => mod.Katex), { ssr: false });

type SolveMathResponse = {
  ok?: boolean;
  id?: string;
  resultPath?: string;
  error?: string;
  errorAr?: string;
  /** Guest trial exhausted, or the visitor must sign in: the chat answers with a sign-up card. */
  guestLimitReached?: boolean;
  needSignIn?: boolean;
  signUpUrl?: string;
  subscribeUrl?: string;
};

export type SolverSample = { id: string; label: string; tex: string; question: string; track: CertificateTrack; math: ReactNode };

const SOLVER_TRACKS: CertificateTrack[] = ["brevet", "ls", "gs", "se", "sat", "lh", "eb7", "eb8", "s1", "university"];
/** Exam names are proper nouns (shown as-is); `university` is translated. */
const TRACK_OPTIONS: { value: CertificateTrack; label?: string }[] = [
  { value: "brevet", label: "Brevet" },
  { value: "ls", label: "Terminale LS" },
  { value: "gs", label: "Terminale GS" },
  { value: "se", label: "Terminale SE" },
  { value: "sat", label: "SAT" },
  { value: "lh", label: "LH" },
  { value: "university" },
];

function asSolverTrack(value: string | undefined): CertificateTrack | undefined {
  if (!value) return undefined;
  return SOLVER_TRACKS.includes(value as CertificateTrack) ? (value as CertificateTrack) : undefined;
}

type Sent = { text: string; photo: string | null };

/** Chat-style solver: sample chips, sticky dock (camera · upload · text · send), options, typing state. */
export function SolverChat({ samples, initialQuestion, focusPhoto }: { samples: SolverSample[]; initialQuestion: string; focusPhoto: boolean }) {
  const { locale, m: t } = useI18n();
  const s = t.solver;
  const router = useRouter();
  const reduce = useReducedMotion();
  const { solverTrack, curriculumId, ready } = useCurriculum();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const cameraButton = useRef<HTMLButtonElement>(null);
  const [question, setQuestion] = useState(initialQuestion);
  const [latex, setLatex] = useState("");
  // Solutions default to English; Arabic / French only when the student picks them (solver-doctor rule).
  const [language, setLanguage] = useState<LessonLanguage>("en");
  const [examStyle, setExamStyle] = useState<SolverCurriculumChoice>("auto");
  const [track, setTrack] = useState<CertificateTrack>("brevet");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState("");
  const [gate, setGate] = useState<{ message: string; signUp: string; subscribe: string } | null>(null);

  useEffect(() => {
    if (!ready) return;
    const mapped = asSolverTrack(solverTrack);
    if (mapped) setTrack(mapped);
  }, [ready, solverTrack]);

  useEffect(() => {
    if (focusPhoto) cameraButton.current?.focus();
  }, [focusPhoto]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickFile = (next: File | null) => {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  };

  const busy = sent !== null && !error && !gate;
  const empty = !question.trim() && !latex.trim() && !file;

  const submit = async () => {
    if (empty || busy) return;
    setError("");
    setGate(null);
    setSent({ text: question.trim() || latex.trim(), photo: preview });
    try {
      const form = new FormData();
      form.set("question", question);
      form.set("latex", latex);
      form.set("language", language);
      form.set("track", track);
      form.set("curriculum", examStyle);
      form.set("platformCurriculum", curriculumId);
      if (file) form.set("image", file);
      const response = await fetch("/api/solve-math", { method: "POST", body: form, credentials: "same-origin" });
      const payload = (await response.json()) as SolveMathResponse;
      if (!response.ok || !payload.ok || !payload.id) {
        const message = (locale === "ar" && payload.errorAr) || payload.error || s.failed;
        if (payload.guestLimitReached || payload.needSignIn) {
          setGate({
            message,
            signUp: payload.signUpUrl || "/signup?next=%2Fmath-solver",
            subscribe: payload.subscribeUrl || "/subscribe",
          });
        } else {
          setError(message);
        }
        return;
      }
      router.push(payload.resultPath || `/math-solver/result/${payload.id}`);
    } catch {
      setError(s.network);
    }
  };

  const fade = reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };

  return (
    <MotionProvider>
      <div className="v2-solver-thread">
        <div className="v2-solver-samples" aria-label={s.samples}>
          <p className="v2-muted v2-small">{s.samples}</p>
          <div className="v2-chip-row">
            {samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                className="v2-chip v2-chip-btn"
                aria-label={`${s.sampleUse}: ${sample.label}`}
                onClick={() => {
                  setQuestion(sample.question);
                  setLatex(formatLebaneseEquation(sample.tex));
                  setTrack(sample.track);
                }}
              >
                {sample.math}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {sent ? (
            <m.div key="sent" className="v2-bub me" {...fade}>
              {sent.photo ? <img className="v2-bub-photo" src={sent.photo} alt={s.photoAlt} /> : null}
              {sent.text ? <p dir="auto">{sent.text}</p> : null}
            </m.div>
          ) : null}
          {busy ? (
            <m.div key="typing" className="v2-thinking" {...fade} role="status" aria-live="polite">
              <p className="v2-ai-head">
                <TutorOrb mini state="thinking" /> {t.tutor.thinking} <AiTutorBadge label={t.persona.ai} />
              </p>
              <span className="v2-bub ai v2-typing" aria-hidden="true">
                <i />
                <i />
                <i />
                <span className="v2-typing-label">{t.tutor.typing}</span>
              </span>
            </m.div>
          ) : null}
        </AnimatePresence>
        {error ? (
          <p className="mm-widget-error" role="alert">
            {error}
          </p>
        ) : null}
        {gate ? (
          <m.div className="v2-bub ai mm-guest-gate" role="alert" {...fade}>
            <p>{gate.message}</p>
            <div className="v2-chip-row">
              <Link className="v2-chip v2-chip-btn" href={gate.signUp}>
                {s.guestSignUp}
              </Link>
              <Link className="v2-chip v2-chip-btn" href={gate.subscribe}>
                {s.guestSubscribe}
              </Link>
            </div>
          </m.div>
        ) : null}
      </div>

      <section className="v2-solver-ask glass" aria-label={s.inputLabel}>
      <div className="v2-solver-style">
        <label className="mm-field">
          <span>{s.styleLabel}</span>
          <select value={examStyle} onChange={(event) => setExamStyle(event.target.value as SolverCurriculumChoice)} aria-describedby="v2-solver-style-help">
            {SOLVER_CURRICULUM_CHOICES.map((id) => (
              <option key={id} value={id}>
                {s.curricula[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="mm-field">
          <span>{s.language}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as LessonLanguage)}>
            <option value="en" lang="en">English</option>
            <option value="ar" lang="ar">العربية</option>
            <option value="fr" lang="fr">Français</option>
          </select>
        </label>
        <p id="v2-solver-style-help" className="v2-muted v2-small">
          {s.styleHelp}
        </p>
      </div>

      <form
        className="v2-dock"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {preview ? (
          <div className="v2-dock-preview">
            <img src={preview} alt={s.photoAlt} />
            <button type="button" className="mm-icon-btn" onClick={() => pickFile(null)} aria-label={s.removePhoto} title={s.removePhoto}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ) : null}
        <details className="v2-dock-options">
          <summary>{s.options}</summary>
          <div className="v2-dock-options-grid">
            <label className="mm-field">
              <span>{s.track}</span>
              <select value={track} onChange={(event) => setTrack(event.target.value as CertificateTrack)} dir="ltr">
                {TRACK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label ?? s.trackUniversity}
                  </option>
                ))}
              </select>
            </label>
            <label className="mm-field v2-dock-latex">
              <span>{s.latexLabel}</span>
              <input value={latex} onChange={(event) => setLatex(formatLebaneseEquation(event.target.value))} dir="ltr" />
            </label>
            {latex ? (
              <p className="latex-preview">
                <Katex tex={latex} display />
              </p>
            ) : null}
          </div>
        </details>
        <div className="v2-dock-row">
          <button ref={cameraButton} type="button" className="v2-dock-btn is-gold" onClick={() => cameraRef.current?.click()} aria-label={s.photo} title={s.photo}>
            <Icon name="camera" size={20} />
          </button>
          <button type="button" className="v2-dock-btn" onClick={() => fileRef.current?.click()} aria-label={s.upload} title={s.upload}>
            <Icon name="image" size={20} />
          </button>
          <label className="sr-only" htmlFor="v2-solver-q">
            {s.inputLabel}
          </label>
          <textarea
            id="v2-solver-q"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={1}
            dir="auto"
            placeholder={s.placeholder}
          />
          <button type="submit" className="v2-dock-btn is-primary" disabled={busy || empty} aria-label={busy ? s.sending : s.send} title={busy ? s.sending : s.send}>
            <Icon name="send" size={20} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => pickFile(event.target.files?.[0] ?? null)} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => pickFile(event.target.files?.[0] ?? null)} />
      </form>
      </section>
    </MotionProvider>
  );
}
