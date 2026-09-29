"use client";

import { officialExamFourPhaseLesson } from "@/lib/studio/seedLesson";
import { pickText } from "@/lib/studio/i18n";
import { TeacherQualityChecklist } from "@/components/studio/TeacherQualityChecklist";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type JobStatus = "queued" | "processing" | "completed" | "failed";

type HeyGenJob = {
  id: string;
  lessonId: string;
  title: string;
  script: string;
  notes: string;
  mathExamples: string;
  language: "en" | "fr" | "ar";
  speed: number;
  status: JobStatus;
  heygenVideoId?: string;
  videoUrl?: string;
  studentEnabled: boolean;
  demo: boolean;
  message: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  playerPath?: string;
};

const DEFAULT_SCRIPT = officialExamFourPhaseLesson.segments
  .map((segment) => pickText(segment.narration, "en"))
  .join("\n\n");

const DEFAULT_NOTES =
  "Paid-lesson bar: (1) LS/GS/SE framing + domain R with justification, (2) limit at −∞ rewritten as −(t+1)/e^t + product-rule proof of f'=x e^x + table of variation + timed graph (root, min, asymptote), (3) official exercise f(x)=m and f(x)=−1/2 with ≥3 graded steps, (4) trap: (−∞)×0 and f'=e^x corrected. EN+FR equal quality. Instructor: Prof. Munzer Haddara.";

const DEFAULT_MATH = `f(x)=(x-1)e^{x},\\ D_f=\\mathbb{R}
\\lim_{x\\to-\\infty}f(x)=0\\ (t=-x)
f'(x)=xe^{x}
\\min(0,-1),\\ f(1)=0,\\ y=0
f(x)=-1/2:\\ two\\ roots`;

const DEFAULT_TIMELINE = JSON.stringify(officialExamFourPhaseLesson, null, 2);

function statusClass(status: JobStatus) {
  if (status === "completed") return "badge approved";
  if (status === "failed") return "badge rejected";
  if (status === "processing") return "badge pending";
  return "badge";
}

export default function AdminVideoGeneratorPage() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [mathExamples, setMathExamples] = useState(DEFAULT_MATH);
  const [language, setLanguage] = useState<"en" | "fr" | "ar">("en");
  const [speed, setSpeed] = useState(1);
  const [lessonId, setLessonId] = useState("leb-term-func-01");
  const [timelineJson, setTimelineJson] = useState(DEFAULT_TIMELINE);
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [jobs, setJobs] = useState<HeyGenJob[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const headers = useMemo(() => {
    const next: Record<string, string> = { "Content-Type": "application/json" };
    if (adminToken.trim()) next["x-admin-token"] = adminToken.trim();
    return next;
  }, [adminToken]);

  const refreshJobs = useCallback(async () => {
    const response = await fetch("/api/heygen/jobs", { headers });
    const payload = (await response.json()) as { jobs?: HeyGenJob[]; notice?: string; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not load jobs.");
      return;
    }
    setJobs(payload.jobs ?? []);
    if (payload.notice) setNotice(payload.notice);
  }, [headers]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    const pending = jobs.filter((job) => job.status === "queued" || job.status === "processing");
    if (!pending.length) return;
    const timer = window.setInterval(() => {
      void (async () => {
        for (const job of pending) {
          const response = await fetch(`/api/heygen/status?jobId=${encodeURIComponent(job.id)}`);
          const payload = (await response.json()) as { job?: HeyGenJob };
          if (payload.job) {
            setJobs((current) => current.map((item) => (item.id === payload.job!.id ? { ...item, ...payload.job! } : item)));
          }
        }
      })();
    }, 1200);
    return () => window.clearInterval(timer);
  }, [jobs]);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/heygen/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          script,
          notes,
          mathExamples,
          language,
          speed,
          lessonId,
          title: `MathMentor · ${lessonId}`,
          timelineJson,
        }),
      });
      const payload = (await response.json()) as {
        job?: HeyGenJob;
        error?: string;
        notice?: string;
        demoMode?: boolean;
      };
      if (!response.ok || !payload.job) {
        setError(payload.error ?? "Generate failed.");
        return;
      }
      setActiveId(payload.job.id);
      setNotice(
        payload.notice ??
          (payload.demoMode
            ? "Demo mode: no HEYGEN_API_KEY. Polling will complete a local placeholder video."
            : "HeyGen job created."),
      );
      setJobs((current) => [payload.job!, ...current.filter((job) => job.id !== payload.job!.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  const active = jobs.find((job) => job.id === activeId) ?? jobs[0];

  return (
    <main className="shell" dir="ltr">
      <p className="eyebrow">Admin · منصة الأستاذ منذر حداره</p>
      <h1>HeyGen video generator</h1>
      <p className="muted">
        Write the lesson in{" "}
        <Link href="/studio/script">/studio/script</Link>, generate a talking-avatar video here, wait for webhook or
        status polling, then open the sync player. Seeded lesson: <code>leb-term-func-01</code> (full Terminale study).
        Instructor: Prof. Munzer Haddara / الأستاذ منذر حداره. Teacher voice dictation:{" "}
        <Link href="/studio/voice-solver">/studio/voice-solver</Link>.
      </p>

      <TeacherQualityChecklist />

      <section className="card" style={{ marginTop: 18, background: "#fff8e8" }}>
        <p className="eyebrow">Auth</p>
        <p>
          Sign in as <strong>teacher or admin</strong> to generate. Optional{" "}
          <code>HEYGEN_ADMIN_TOKEN</code> is a bearer override for scripts. The HeyGen API key stays server-side only.
        </p>
        <label>
          Optional admin token
          <input
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="HEYGEN_ADMIN_TOKEN (optional)"
            autoComplete="off"
          />
        </label>
        {notice ? <p className="muted">{notice}</p> : null}
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="grid two">
          <label>
            Lesson id / timeline
            <input value={lessonId} onChange={(event) => setLessonId(event.target.value)} />
          </label>
          <label>
            Voice language
            <select value={language} onChange={(event) => setLanguage(event.target.value as "en" | "fr" | "ar")}>
              <option value="en">English (en-US)</option>
              <option value="fr">Français (fr-FR)</option>
              <option value="ar">العربية (ar-SA, if the HeyGen voice supports it)</option>
            </select>
          </label>
          <label>
            Speech speed (HeyGen 0.5–1.5)
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              {[0.75, 1, 1.15, 1.25, 1.5].map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Lesson script / narration
          <textarea value={script} onChange={(event) => setScript(event.target.value)} style={{ minHeight: 180 }} />
        </label>
        <label>
          Ideas / pedagogical notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label>
          Math examples (LaTeX or plain)
          <textarea value={mathExamples} onChange={(event) => setMathExamples(event.target.value)} />
        </label>
        <label>
          Timeline JSON (optional — linked to the job)
          <textarea
            value={timelineJson}
            onChange={(event) => setTimelineJson(event.target.value)}
            style={{ minHeight: 220, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
          />
        </label>
        <div className="row">
          <button className="btn dark" type="button" disabled={busy || !script.trim()} onClick={() => void generate()}>
            {busy ? "Generating…" : "Generate Video"}
          </button>
          <Link className="btn" href="/studio/script">
            Script studio
          </Link>
          <Link className="btn" href="/lessons/interactive">
            Student sync player
          </Link>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Jobs</h2>
        <p className="muted">Status: queued → processing → completed / failed. Completed jobs enable the lesson for students.</p>
        {jobs.length === 0 ? <p className="muted">No jobs yet.</p> : null}
        <div className="heygen-jobs">
          {jobs.map((job) => (
            <article key={job.id} className={`heygen-job ${job.id === active?.id ? "active" : ""}`}>
              <header>
                <strong>{job.title}</strong>
                <span className={statusClass(job.status)}>{job.status}</span>
                {job.studentEnabled ? <span className="badge approved">students on</span> : null}
                {job.demo ? <span className="badge">demo</span> : null}
              </header>
              <p className="muted">
                {job.lessonId} · {job.language} · {job.speed}× · {job.id}
                {job.heygenVideoId ? ` · heygen ${job.heygenVideoId}` : ""}
              </p>
              <p>{job.message}</p>
              <div className="row">
                <Link className="btn dark" href={job.playerPath ?? `/studio/player?job=${encodeURIComponent(job.id)}`}>
                  Open sync player
                </Link>
                {job.videoUrl ? (
                  <a className="btn" href={job.videoUrl} target="_blank" rel="noreferrer">
                    Video URL
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
