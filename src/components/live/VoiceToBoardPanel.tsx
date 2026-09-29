"use client";

import { useState } from "react";
import { VoiceRecorder, type RecordedClip } from "@/components/voice/VoiceRecorder";
import { Katex } from "@/components/studio/Katex";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { useCurriculum } from "@/components/curriculum/CurriculumProvider";
import { DEMO_DICTATIONS } from "@/lib/voiceMath/demo";
import {
  callPedagogicalTutorClient,
  tutorLatexFragments,
} from "@/lib/voiceMath/callPedagogicalTutorClient";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import type { WhiteboardEquation } from "@/lib/livekit/protocol";
import type { LatexStep, VoiceMathJob } from "@/lib/voiceMath/types";
import type { PedagogicalTutorResult } from "@/lib/curriculum/tutorTypes";

type SolvePayload = {
  ok?: boolean;
  job?: VoiceMathJob;
  latexSteps?: LatexStep[];
  transcript?: { text: string; formattedLatex?: string; source?: string; warning?: string; warningAr?: string };
  warning?: string;
  error?: string;
  errorAr?: string;
};

type Props = {
  authorId: string;
  onEquation: (equation: WhiteboardEquation) => void;
  disabled?: boolean;
};

function uniqueLatexFragments(job: VoiceMathJob): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | undefined) => {
    const cleaned = formatLebaneseEquation((raw ?? "").trim());
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    out.push(cleaned);
  };

  push(job.latexDraft);
  for (const step of job.latexSteps) {
    push(step.latex);
  }
  push(job.transcript.formattedLatex);
  if (out.length === 0 && job.finalAnswerLatex) push(job.finalAnswerLatex);
  return out;
}

function pushLatexList(
  fragments: string[],
  authorId: string,
  onEquation: (equation: WhiteboardEquation) => void,
  prefix: string,
): number {
  const stamp = Date.now().toString(36);
  fragments.forEach((latex, index) => {
    onEquation({
      id: `eq-${prefix}-${stamp}-${index.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      latex: formatLebaneseEquation(latex),
      authorId,
      createdAt: new Date().toISOString(),
    });
  });
  return fragments.length;
}

export function VoiceToBoardPanel({ authorId, onEquation, disabled }: Props) {
  const { curriculumId, curriculum, ready } = useCurriculum();
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [phase, setPhase] = useState<"idle" | "stt" | "tutor">("idle");
  const [error, setError] = useState("");
  const [errorAr, setErrorAr] = useState("");
  const [notice, setNotice] = useState("");
  const [demoId, setDemoId] = useState(DEMO_DICTATIONS[0].id);
  const [pushedCount, setPushedCount] = useState(0);
  const [tutor, setTutor] = useState<PedagogicalTutorResult | null>(null);

  const busy = phase !== "idle";

  const submit = async (opts: { demo: boolean }) => {
    setPhase("stt");
    setError("");
    setErrorAr("");
    setNotice("");
    setPushedCount(0);
    setTutor(null);
    try {
      const form = new FormData();
      form.set("language", curriculum.defaultLanguage === "ar" ? "ar" : "en");
      form.set("track", "ls");
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
        setError("Record audio first, or use the demo transcript.");
        setErrorAr("سجّل صوتًا أولًا، أو استخدم النص التجريبي.");
        setPhase("idle");
        return;
      }

      const response = await fetch("/api/voice-math", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const payload = (await response.json()) as SolvePayload;
      if (!response.ok || !payload.ok || !payload.job) {
        setError(payload.error || "Could not convert speech to board math.");
        setErrorAr(payload.errorAr || "تعذّر تحويل الصوت إلى معادلات على السبورة.");
        setPhase("idle");
        return;
      }

      const job = payload.job;
      const voiceCount = pushLatexList(uniqueLatexFragments(job), authorId, onEquation, "voice");

      setPhase("tutor");
      const tutorLang = curriculum.defaultLanguage === "ar" ? "ar" : "en";
      const tutorResult = await callPedagogicalTutorClient({
        text: job.transcript.text || job.question,
        latex: job.latexDraft || job.transcript.formattedLatex || job.finalAnswerLatex,
        curriculumId,
        language: tutorLang,
        mode: "direct",
        revealAnswer: true,
      });

      let tutorCount = 0;
      if (tutorResult.ok) {
        setTutor(tutorResult);
        tutorCount = pushLatexList(tutorLatexFragments(tutorResult), authorId, onEquation, "tutor");
        if (tutorResult.warning) {
          setNotice(
            [
              payload.warning || job.warning,
              tutorResult.warning,
              tutorResult.warningAr,
              `أُرسلت ${voiceCount + tutorCount} معادلة إلى السبورة (صوت + معلّم) / Pushed ${voiceCount + tutorCount} equation(s) (voice + tutor).`,
            ]
              .filter(Boolean)
              .join(" · "),
          );
        } else {
          setNotice(
            payload.warning ||
              job.warning ||
              `أُرسلت ${voiceCount + tutorCount} معادلة (صوت + معلّم بيداغوجي) / Pushed ${voiceCount + tutorCount} (voice + pedagogical tutor).`,
          );
        }
      } else {
        setNotice(
          payload.warning ||
            job.warning ||
            (voiceCount > 0
              ? `أُرسلت ${voiceCount} معادلة من الصوت؛ تعذّر المعلّم. / Voice board OK (${voiceCount}); tutor failed.`
              : "تم التحويل لكن لم تُستخرج معادلات."),
        );
        const tutorErr = tutorResult.error || "Tutor failed.";
        const tutorErrAr = tutorResult.errorAr || "تعذّر المعلّم.";
        const paywalled = /AI_TIER|subscription required|اشتراك/i.test(tutorErr + tutorErrAr);
        setError(paywalled ? `${tutorErr} Redeem at /redeem?need=ai` : tutorErr);
        setErrorAr(paywalled ? `${tutorErrAr} · فعّل على /redeem` : tutorErrAr);
      }
      setPushedCount(voiceCount + tutorCount);
    } catch {
      setError("Network error while converting voice.");
      setErrorAr("خطأ في الشبكة أثناء تحويل الصوت.");
    } finally {
      setPhase("idle");
    }
  };

  const sample = DEMO_DICTATIONS.find((item) => item.id === demoId) ?? DEMO_DICTATIONS[0];

  return (
    <section className="card live-voice-to-board mm-mobile-stack" aria-label="تسجيل صوت للسبورة / Voice to board">
      <p className="eyebrow">تسجيل صوت للسبورة / Voice → Tutor → Board</p>
      <h2>الميكروفون → المعلّم البيداغوجي → السبورة</h2>
      <p className="muted">
        سجّل شرحًا قصيرًا؛ Whisper (أو نص تجريبي) → LaTeX → معلّم مباشر ({curriculum.labelAr}
        {!ready ? "…" : ""}) → KaTeX على السبورة المشتركة.
      </p>

      <VoiceRecorder onClip={setClip} disabled={disabled || busy} compact />

      <div className="live-voice-demo" style={{ marginTop: 12 }}>
        <p className="eyebrow">بدون ميكروفون / Demo (no Whisper credits needed)</p>
        <div className="row sample-chips" style={{ marginTop: 8 }}>
          {DEMO_DICTATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${demoId === item.id ? "active" : ""}`}
              disabled={busy || disabled}
              onClick={() => setDemoId(item.id)}
            >
              {item.labelAr}
            </button>
          ))}
        </div>
        <p className="paper muted" dir="auto" style={{ marginTop: 8, fontSize: "0.9rem" }}>
          {sample.transcript.slice(0, 160)}
          {sample.transcript.length > 160 ? "…" : ""}
        </p>
      </div>

      <div className="row live-voice-actions" style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
        <button
          className="btn dark"
          type="button"
          disabled={busy || disabled || !clip}
          onClick={() => void submit({ demo: false })}
        >
          {busy ? "…" : "إلى السبورة / Push recording"}
        </button>
        <button className="btn" type="button" disabled={busy || disabled} onClick={() => void submit({ demo: true })}>
          {busy ? (phase === "tutor" ? "معلّم…" : "جارٍ التحويل…") : "تجربة إلى السبورة / Demo to board"}
        </button>
      </div>

      <ApiErrorBanner error={error} errorAr={errorAr} className="live-voice-error" />
      {busy ? (
        <div className="live-voice-skeleton" style={{ marginTop: 12 }} aria-busy="true">
          <SkeletonBlock
            lines={3}
            label={phase === "tutor" ? "Pedagogical tutor (Direct)…" : "Whisper / Speech-to-LaTeX…"}
          />
        </div>
      ) : null}
      {notice ? (
        <p className="muted" role="status" style={{ marginTop: 10 }}>
          {notice}
          {pushedCount > 0 ? ` · ${pushedCount}` : ""}
        </p>
      ) : null}

      {tutor ? (
        <div className="live-voice-tutor-preview" style={{ marginTop: 12 }}>
          <p className="eyebrow">
            معلّم بيداغوجي · Direct · {tutor.curriculumId} · {tutor.source}
          </p>
          {tutor.steps.slice(0, 4).map((step, index) => (
            <article key={`${step.title}-${index}`} style={{ marginTop: 8 }}>
              <p className="muted">
                {index + 1}. {step.title}
              </p>
              {step.latex ? <Katex tex={step.latex} display /> : null}
            </article>
          ))}
          {tutor.finalAnswerLatex ? (
            <div className="studio-step-boxed" style={{ marginTop: 8 }}>
              <p className="eyebrow">الجواب النهائي / Final answer</p>
              <Katex tex={tutor.finalAnswerLatex} display />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
