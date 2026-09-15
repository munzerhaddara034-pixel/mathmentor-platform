"use client";

import { officialExamSceneDocument } from "@/lib/studio/seedLesson";
import { parseLessonTimeline, TIMELINE_STORAGE_KEY, type LessonTimeline } from "@/lib/studio/timeline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const TRACKS = [
  { id: "brevet", label: "Brevet" },
  { id: "ls", label: "LS · Life Sciences" },
  { id: "gs", label: "GS · General Sciences" },
  { id: "se", label: "SE · Sociology & Economics" },
  { id: "lh", label: "LH · Literature" },
  { id: "s1", label: "S1" },
  { id: "eb7", label: "EB7" },
  { id: "eb8", label: "EB8" },
  { id: "sat", label: "SAT Math" },
] as const;

const SEEDED_JSON = JSON.stringify(officialExamSceneDocument, null, 2);

export default function StudioScriptPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("Exponential Functions");
  const [track, setTrack] = useState("ls");
  const [language, setLanguage] = useState<"en" | "fr">("en");
  const [grade, setGrade] = useState("Terminale LS / GS / SE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"openai" | "template" | "seed">("seed");
  const [warning, setWarning] = useState("");
  const [jsonText, setJsonText] = useState(SEEDED_JSON);
  const [pedagogy, setPedagogy] = useState<{
    phases: string[];
    hasRenderGraph: boolean;
    hasStepByStepEquations: boolean;
  } | null>(null);

  const parsed = useMemo(() => {
    if (!jsonText.trim()) return null;
    try {
      return parseLessonTimeline(JSON.parse(jsonText) as unknown);
    } catch {
      return { success: false as const, error: "Invalid JSON" };
    }
  }, [jsonText]);

  const generate = async () => {
    setBusy(true);
    setError("");
    setWarning("");
    try {
      const response = await fetch("/api/studio/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, track, language, grade }),
      });
      const payload = (await response.json()) as {
        timeline?: LessonTimeline;
        source?: "openai" | "template";
        warning?: string;
        error?: string;
        pedagogy?: { phases: string[]; hasRenderGraph: boolean; hasStepByStepEquations: boolean };
      };
      if (!response.ok || !payload.timeline) {
        setError(payload.error ?? "Could not generate script.");
        return;
      }
      setJsonText(JSON.stringify(payload.timeline, null, 2));
      setSource(payload.source ?? "template");
      setWarning(payload.warning ?? "");
      setPedagogy(payload.pedagogy ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  const openPlayer = () => {
    if (!parsed || !("success" in parsed) || !parsed.success) {
      setError("Fix the JSON before opening the player.");
      return;
    }
    window.sessionStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(JSON.parse(jsonText)));
    router.push("/studio/player?src=session");
  };

  return (
    <main className="shell">
      <p className="eyebrow">Studio · AI video script</p>
      <h1>Lesson script editor</h1>
      <p className="muted">
        Default sample: <code>leb-term-func-01</code> (EN + FR scenes, KaTeX + Function Plot / Desmos). Generate a
        four-phase official-exam script, edit the JSON, then open the interactive player or send it to{" "}
        <Link href="/admin/video-generator">/admin/video-generator</Link>. Local preview:{" "}
        <code>http://127.0.0.1:3001/studio/script</code>
      </p>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="grid two">
          <label>
            Topic
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Exponential Functions" />
          </label>
          <label>
            Track / certificate
            <select value={track} onChange={(event) => setTrack(event.target.value)}>
              {TRACKS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grade
            <input value={grade} onChange={(event) => setGrade(event.target.value)} />
          </label>
          <label>
            Script language default
            <select value={language} onChange={(event) => setLanguage(event.target.value as "en" | "fr")}>
              <option value="en">English (default)</option>
              <option value="fr">Français</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn dark" type="button" disabled={busy} onClick={() => void generate()}>
            {busy ? "Generating…" : "Generate four-phase script"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setJsonText(SEEDED_JSON);
              setSource("seed");
              setPedagogy(null);
            }}
          >
            Reload seeded lesson
          </button>
          <Link className="btn" href="/lessons/interactive">
            Open player demo
          </Link>
          <Link className="btn" href="/admin/video-generator">
            Generate HeyGen video
          </Link>
        </div>
        {source ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Source: {source === "openai" ? "OpenAI" : source === "seed" ? "seeded leb-term-func-01 scenes" : "EN+FR template (no LLM key)"}
          </p>
        ) : null}
        {warning ? <p className="muted">{warning}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {pedagogy ? (
          <p className={pedagogy.hasRenderGraph && pedagogy.hasStepByStepEquations ? "success" : "error"}>
            phases: {pedagogy.phases.join(" → ")} · Render Graph: {pedagogy.hasRenderGraph ? "yes" : "no"} · Step-by-step:{" "}
            {pedagogy.hasStepByStepEquations ? "yes" : "no"}
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Editable script (EN + FR)</h2>
        {parsed && "success" in parsed && parsed.success ? (
          <p className="success">Schema valid — you can open the player.</p>
        ) : (
          <p className="error">JSON does not match the scene document or LessonTimeline schema.</p>
        )}
        <textarea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          style={{ minHeight: 420, fontFamily: "ui-monospace, monospace", fontSize: 13, direction: "ltr", textAlign: "left" }}
        />
        <div className="row">
          <button className="btn dark" type="button" onClick={openPlayer}>
            Open in Interactive Player
          </button>
          <Link className="btn" href="/studio/player?lesson=leb-term-func-01">
            Play seeded scenes
          </Link>
        </div>
      </section>
    </main>
  );
}
