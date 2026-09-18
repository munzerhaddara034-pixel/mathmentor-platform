"use client";

import { useEffect, useMemo, useState } from "react";
import { MathCanvas } from "@/components/studio/MathCanvas";
import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { Katex } from "@/components/studio/Katex";
import { VoiceRecorder, type RecordedClip } from "./VoiceRecorder";
import { DEMO_DICTATIONS } from "@/lib/voiceMath/demo";
import { canvasStateAt, type CertificateTrack, type LessonTimeline } from "@/lib/studio/timeline";
import type { LatexStep, VoiceMathJob } from "@/lib/voiceMath/types";
import type { LessonLanguage } from "@/lib/studio/i18n";
import { pickText } from "@/lib/studio/i18n";

type SolvePayload = {
  ok?: boolean;
  id?: string;
  job?: VoiceMathJob;
  transcript?: { text: string; source?: string; warning?: string };
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
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [language, setLanguage] = useState<LessonLanguage>(initialJob?.language ?? "ar");
  const [track, setTrack] = useState<CertificateTrack>(initialJob?.track ?? "ls");
  const [demoId, setDemoId] = useState(DEMO_DICTATIONS[0].id);
  const [busy, setBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState<VoiceMathJob | null>(initialJob ?? null);
  const [showPlayer, setShowPlayer] = useState(Boolean(initialJob?.timeline));

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
    setBusy(true);
    setError("");
    setNotice("");
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
        setError(payload.errorAr || payload.error || "تعذّر تحويل الشرح.");
        setBusy(false);
        return;
      }
      setJob(payload.job);
      setShowPlayer(false);
      setNotice(payload.warning || payload.job.warning || "تم توليد الخطوات على السبورة.");
    } catch {
      setError("خطأ في الشبكة.");
    } finally {
      setBusy(false);
    }
  };

  const generateVideo = async () => {
    if (!job) return;
    setVideoBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/voice-math/${encodeURIComponent(job.id)}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ language }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        notice?: string;
        error?: string;
        job?: VoiceMathJob;
        playerPath?: string;
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "تعذّر توليد الفيديو.");
        setVideoBusy(false);
        return;
      }
      if (payload.job) setJob(payload.job);
      setShowPlayer(true);
      setNotice(payload.notice || "تم تجهيز الفيديو / الصوتي مع السبورة.");
    } catch {
      setError("خطأ في الشبكة أثناء توليد الفيديو.");
    } finally {
      setVideoBusy(false);
    }
  };

  const sample = DEMO_DICTATIONS.find((item) => item.id === demoId) ?? DEMO_DICTATIONS[0];

  return (
    <div className="voice-studio">
      {canTeach ? (
        <>
          <VoiceRecorder onClip={setClip} disabled={busy} />
          <section className="card" style={{ marginTop: 16 }}>
            <p className="eyebrow">Demo without API keys</p>
            <h2>نص إملاء تجريبي / Sample dictation</h2>
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
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn dark" type="button" disabled={busy || (!clip && !sample)} onClick={() => void solve({ demo: false })}>
                {busy ? "…" : clip ? "حلّ التسجيل / Solve recording" : "يلزم تسجيل أو استخدم التجريب"}
              </button>
              <button className="btn" type="button" disabled={busy} onClick={() => void solve({ demo: true })}>
                {busy ? "جارٍ التحويل…" : "تجربة بدون ميكروفون / Demo transcript"}
              </button>
            </div>
          </section>
        </>
      ) : (
        <p className="muted">Students can view a linked explanation; recording is teacher-only.</p>
      )}

      {error ? (
        <p className="error" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {notice}
        </p>
      ) : null}

      {job ? (
        <section className="card" style={{ marginTop: 20 }}>
          <p className="eyebrow">Speech → LaTeX · Lebanese official sequence</p>
          <h2>{job.question}</h2>
          <p className="muted">
            source {job.transcript.source} → {job.parseSource}
            {job.hasAudio ? " · audio stored" : " · demo / typed"}
            {job.videoStatus !== "none" ? ` · video ${job.videoStatus}` : ""}
          </p>
          <p className="paper" dir="auto">
            {job.transcript.text}
          </p>
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
            <div className="row" style={{ marginTop: 16 }}>
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
            {pickText({ en: "Play with teacher voice after Generate video.", fr: "Lisez avec la voix du professeur après Générer la vidéo." }, language === "fr" ? "fr" : "en")}
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
