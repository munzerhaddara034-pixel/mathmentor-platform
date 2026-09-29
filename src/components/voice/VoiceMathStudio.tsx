"use client";

import { useEffect, useMemo, useState } from "react";
import { MathCanvas } from "@/components/studio/MathCanvas";
import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { Katex } from "@/components/studio/Katex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import { VoiceRecorder, type RecordedClip } from "./VoiceRecorder";
import { useCurriculum } from "@/components/curriculum/CurriculumProvider";
import { DEMO_DICTATIONS } from "@/lib/voiceMath/demo";
import {
  callPedagogicalTutorClient,
} from "@/lib/voiceMath/callPedagogicalTutorClient";
import { canvasStateAt, type CertificateTrack, type LessonTimeline } from "@/lib/studio/timeline";
import type { LatexStep, VoiceMathJob } from "@/lib/voiceMath/types";
import type { LessonLanguage } from "@/lib/studio/i18n";
import { pickText } from "@/lib/studio/i18n";
import type { PedagogicalTutorResult } from "@/lib/curriculum/tutorTypes";
import { ApiErrorBanner, Skeleton, SkeletonBlock } from "@/components/ui/Skeleton";

type VideoPayload = {
  ok?: boolean;
  notice?: string;
  error?: string;
  errorAr?: string;
  job?: VoiceMathJob;
  playerPath?: string;
};

type SolvePayload = {
  ok?: boolean;
  id?: string;
  job?: VoiceMathJob;
  transcript?: { text: string; formattedLatex?: string; source?: string; warning?: string; warningAr?: string };
  latexSteps?: LatexStep[];
  timeline?: LessonTimeline;
  warning?: string;
  error?: string;
  errorAr?: string;
  playerPath?: string;
};

export function VoiceMathStudio({
  initialJob,
  canTeach,
  viewer,
}: {
  initialJob?: VoiceMathJob | null;
  canTeach: boolean;
  viewer: { name: string; phone: string };
}) {
  const { curriculumId, curriculum, ready } = useCurriculum();
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [language, setLanguage] = useState<LessonLanguage>(initialJob?.language ?? "ar");
  const [track, setTrack] = useState<CertificateTrack>(initialJob?.track ?? "ls");
  const [demoId, setDemoId] = useState(DEMO_DICTATIONS[0].id);
  const [phase, setPhase] = useState<"idle" | "stt" | "tutor">("idle");
  const [videoBusy, setVideoBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorAr, setErrorAr] = useState("");
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState<VoiceMathJob | null>(initialJob ?? null);
  const [tutor, setTutor] = useState<PedagogicalTutorResult | null>(null);
  const [showPlayer, setShowPlayer] = useState(Boolean(initialJob?.timeline));

  const busy = phase !== "idle";

  useEffect(() => {
    setJob(initialJob ?? null);
    if (initialJob?.timeline) setShowPlayer(true);
  }, [initialJob?.id]);

  const timeline = job?.timeline;
  const liveCanvas = useMemo(() => {
    if (!timeline) return null;
    return canvasStateAt(timeline, timeline.durationSec);
  }, [timeline]);

  const solve = async (opts: { demo: boolean }) => {
    setPhase("stt");
    setError("");
    setErrorAr("");
    setNotice("");
    setTutor(null);
    try {
      const form = new FormData();
      form.set("language", language);
      form.set("track", track);
      if (opts.demo) {
        const sample = DEMO_DICTATIONS.find((item) => item.id === demoId) ?? DEMO_DICTATIONS[0];
        form.set("demo", "1");
        form.set("transcript", sample.transcript);
        form.set("language", sample.language);
        form.set("track", sample.track);
      } else if (clip) {
        form.set("audio", clip.blob, clip.mimeType.includes("wav") ? "dictation.wav" : "dictation.webm");
        form.set("durationSec", String(clip.durationSec));
      } else {
        form.set("demo", "1");
      }
      const response = await fetch("/api/voice-math", { method: "POST", body: form, credentials: "same-origin" });
      const payload = (await response.json()) as SolvePayload;
      if (!response.ok || !payload.ok || !payload.job) {
        setError(payload.error || "Could not convert the explanation.");
        setErrorAr(payload.errorAr || "تعذّر تحويل الشرح.");
        setPhase("idle");
        return;
      }
      const nextJob = payload.job;
      setJob(nextJob);
      setShowPlayer(false);
      setNotice(payload.warning || nextJob.warning || "تم توليد الخطوات على السبورة.");

      setPhase("tutor");
      const tutorLang = language === "ar" ? "ar" : "en";
      const tutorResult = await callPedagogicalTutorClient({
        text: nextJob.transcript.text || nextJob.question,
        latex: nextJob.latexDraft || nextJob.transcript.formattedLatex || nextJob.finalAnswerLatex,
        curriculumId,
        language: tutorLang,
        mode: "direct",
        revealAnswer: true,
      });
      if (tutorResult.ok) {
        setTutor(tutorResult);
        const bits = [
          payload.warning || nextJob.warning,
          tutorResult.warning,
          tutorResult.warningAr,
          `معلّم بيداغوجي (${tutorResult.source}) · منهج ${curriculum.labelAr} / Pedagogical tutor on studio board.`,
        ].filter(Boolean);
        setNotice(bits.join(" · "));
      } else {
        setError(tutorResult.error);
        setErrorAr(tutorResult.errorAr);
      }
    } catch {
      setError("Network error.");
      setErrorAr("خطأ في الشبكة.");
    } finally {
      setPhase("idle");
    }
  };

  const generateVideo = async () => {
    if (!job) return;
    setVideoBusy(true);
    setError("");
    setErrorAr("");
    try {
      const response = await fetch(`/api/voice-math/${encodeURIComponent(job.id)}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ language }),
      });
      const payload = (await response.json()) as VideoPayload;
      if (!response.ok || !payload.ok) {
        setError(payload.error || "Could not generate video.");
        setErrorAr(payload.errorAr || "تعذّر توليد الفيديو.");
        setVideoBusy(false);
        return;
      }
      if (payload.job) setJob(payload.job);
      setShowPlayer(true);
      setNotice(payload.notice || "تم تجهيز الفيديو / الصوتي مع السبورة.");
    } catch {
      setError("Network error while generating video.");
      setErrorAr("خطأ في الشبكة أثناء توليد الفيديو.");
    } finally {
      setVideoBusy(false);
    }
  };

  const sample = DEMO_DICTATIONS.find((item) => item.id === demoId) ?? DEMO_DICTATIONS[0];

  return (
    <div className="voice-studio mm-mobile-stack">
      {canTeach ? (
        <>
          <VoiceRecorder onClip={setClip} disabled={busy} />
          <section className="card" style={{ marginTop: 16 }}>
            <p className="eyebrow">Voice → Pedagogical tutor → Board · {curriculum.labelEn}</p>
            <h2>نص إملاء تجريبي / Sample dictation</h2>
            <p className="muted">
              منهج من شريط التنقّل (CurriculumSwitcher
              {!ready ? "…" : ` · ${curriculumId}`}). الوضع: Direct. بدون رصيد Whisper استخدم Demo.
            </p>
            <div className="row sample-chips" style={{ marginTop: 8 }}>
              {DEMO_DICTATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip ${demoId === item.id ? "active" : ""}`}
                  onClick={() => {
                    setDemoId(item.id);
                    setLanguage(item.language);
                    setTrack(item.track);
                  }}
                >
                  {item.labelAr}
                </button>
              ))}
            </div>
            <p className="paper" dir="auto">
              {sample.transcript}
            </p>
            <div className="row" style={{ marginTop: 12 }}>
              <label>
                Language
                <select value={language} onChange={(event) => setLanguage(event.target.value as LessonLanguage)}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </label>
              <label>
                Track
                <select value={track} onChange={(event) => setTrack(event.target.value as CertificateTrack)}>
                  <option value="brevet">Brevet</option>
                  <option value="ls">LS</option>
                  <option value="gs">GS</option>
                  <option value="se">SE</option>
                  <option value="sat">SAT</option>
                </select>
              </label>
            </div>
            <div className="row" style={{ marginTop: 16, flexWrap: "wrap", gap: 8 }}>
              <button
                className="btn dark"
                type="button"
                disabled={busy || (!clip && !sample)}
                onClick={() => void solve({ demo: false })}
              >
                {busy ? "…" : clip ? "حلّ التسجيل / Solve recording" : "يلزم تسجيل أو استخدم التجريب"}
              </button>
              <button className="btn" type="button" disabled={busy} onClick={() => void solve({ demo: true })}>
                {busy
                  ? phase === "tutor"
                    ? "معلّم بيداغوجي…"
                    : "جارٍ التحويل…"
                  : "تجربة بدون ميكروفون / Demo transcript"}
              </button>
            </div>
          </section>
        </>
      ) : (
        <p className="muted">Students can view a linked explanation; recording is teacher-only.</p>
      )}

      <ApiErrorBanner error={error} errorAr={errorAr} className="voice-submit-error" />
      {busy ? (
        <div className="card voice-submit-skeleton" style={{ marginTop: 16 }} aria-busy="true">
          <p className="eyebrow">{phase === "tutor" ? "Pedagogical tutor (Direct)" : "Voice → Math"}</p>
          <SkeletonBlock
            lines={3}
            label={phase === "tutor" ? "Running Direct-mode tutor…" : "Submitting voice-math…"}
          />
          <Skeleton height={160} rounded="lg" label="Canvas skeleton" />
        </div>
      ) : null}
      {notice ? (
        <p className="muted" role="status" style={{ marginTop: 12 }}>
          {notice}
        </p>
      ) : null}

      {job ? (
        <section className="card" style={{ marginTop: 20 }}>
          <p className="eyebrow">Speech → LaTeX · Lebanese official sequence</p>
          <MixedMathText as="h2" text={job.question} />
          <p className="muted">
            source {job.transcript.source} → {job.parseSource}
            {job.hasAudio ? " · audio stored" : " · demo / typed"}
            {job.videoStatus !== "none" ? ` · video ${job.videoStatus}` : ""}
          </p>
          <p className="paper" dir="auto">
            {job.transcript.text}
          </p>
          {job.transcript.formattedLatex ? (
            <div className="voice-cleaned-latex" style={{ marginTop: 12 }}>
              <p className="eyebrow">Formatting cleaning layer · Word Insert Equation</p>
              <p className="paper" dir="ltr">
                {job.transcript.formattedLatex}
              </p>
              {/[\u0600-\u06FF]/.test(job.transcript.formattedLatex) ? null : (
                <Katex tex={job.transcript.formattedLatex} display />
              )}
            </div>
          ) : null}
          {job.latexDraft ? (
            <p style={{ marginTop: 12 }}>
              <Katex tex={job.latexDraft} display />
            </p>
          ) : null}
          <div className="voice-latex-steps">
            {job.latexSteps.map((step, index) => (
              <article key={`${step.title}-${index}`} className={step.boxed ? "studio-step-boxed" : undefined}>
                <p className="eyebrow">
                  {index + 1}. {step.titleAr || step.title}
                  {step.examVerbEn ? ` · ${step.examVerbEn} / ${step.examVerbFr ?? ""}` : ""}
                </p>
                {step.latex ? <Katex tex={step.latex} display /> : null}
                <p>{step.explanationAr || step.explanationEn}</p>
              </article>
            ))}
          </div>
          {canTeach ? (
            <div className="row" style={{ marginTop: 16, flexWrap: "wrap", gap: 8 }}>
              <button className="btn dark" type="button" disabled={videoBusy} onClick={() => void generateVideo()}>
                {videoBusy ? "…" : "توليد فيديو بصوت الأستاذ / Generate video with teacher voice"}
              </button>
              {job.timeline ? (
                <button className="btn" type="button" onClick={() => setShowPlayer(true)}>
                  تشغيل السبورة / Play canvas
                </button>
              ) : null}
              <a className="btn" href={`/lessons/voice-solver?id=${encodeURIComponent(job.id)}`}>
                فتح للاعب الطالب / Student player
              </a>
            </div>
          ) : null}
        </section>
      ) : null}

      {tutor ? (
        <section className="card voice-tutor-board" style={{ marginTop: 20 }} aria-label="Pedagogical tutor board">
          <p className="eyebrow">
            معلّم بيداغوجي · Direct · {tutor.curriculumId} · {tutor.source}
          </p>
          <h2>خطوات KaTeX على سبورة الاستوديو</h2>
          <p className="muted">
            <strong>Objective:</strong> {tutor.curriculumObjective}
          </p>
          <p className="muted">
            <strong>Prerequisite:</strong> {tutor.prerequisiteConcept}
          </p>
          <div className="voice-latex-steps">
            {tutor.steps.map((step, index) => (
              <article key={`tutor-${step.title}-${index}`}>
                <p className="eyebrow">
                  {index + 1}. {step.title}
                </p>
                {step.latex ? <Katex tex={step.latex} display /> : null}
                <p>{step.justification}</p>
              </article>
            ))}
          </div>
          {tutor.finalAnswerLatex || tutor.finalAnswer ? (
            <div className="studio-step-boxed" style={{ marginTop: 12 }}>
              <p className="eyebrow">الجواب النهائي / Final answer</p>
              {tutor.finalAnswerLatex ? <Katex tex={tutor.finalAnswerLatex} display /> : null}
              <p>{tutor.finalAnswer}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {liveCanvas && timeline && !showPlayer ? (
        <div className="voice-live-canvas" style={{ marginTop: 20 }}>
          <MathCanvas
            state={liveCanvas}
            language={language === "fr" ? "fr" : "en"}
            currentTime={timeline.durationSec}
            watermarkName={viewer.name}
            watermarkPhone={viewer.phone}
          />
          <p className="muted">
            Live canvas: Key Idea → D_f → limits/asymptotes → f′ / variation table → C_f → boxed answers.{" "}
            {pickText(
              {
                en: "Play with teacher voice after Generate video.",
                fr: "Lisez avec la voix du professeur après Générer la vidéo.",
              },
              language === "fr" ? "fr" : "en",
            )}
          </p>
        </div>
      ) : null}

      {showPlayer && job?.timeline ? (
        <div style={{ marginTop: 20 }}>
          <InteractiveLessonPlayer timeline={job.timeline} canTeach={canTeach} teacherMode={false} viewer={viewer} />
        </div>
      ) : null}
    </div>
  );
}
