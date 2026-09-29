"use client";

import { Katex } from "@/components/studio/Katex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import {
  DIGITAL_SAT_MATH_BLUEPRINT,
  OFFICIAL_SAT_LINKS,
  buildAiEmployeeOfficialPrompt,
  type OfficialSatTestNumber,
} from "@/lib/exams/officialSatBlueprint";
import type { GeneratedSimilarQuestion, GeneratedSimilarSet } from "@/lib/exams/types";
import { useMemo, useState } from "react";

const SKILL_OPTIONS = [
  "",
  ...Array.from(
    new Set(DIGITAL_SAT_MATH_BLUEPRINT.domains.flatMap((d) => d.skillTags)),
  ),
];

type Props = {
  /** Compact layout for voice-solver sidebar. */
  compact?: boolean;
};

export function AiEmployeeOfficialCommand({ compact }: Props) {
  const [officialTest, setOfficialTest] = useState<OfficialSatTestNumber>(5);
  const [count, setCount] = useState(3);
  const [skill, setSkill] = useState("");
  const [module, setModule] = useState<"" | "1" | "2">("");
  const [skillNote, setSkillNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [errorAr, setErrorAr] = useState<string | undefined>();
  const [set, setResult] = useState<GeneratedSimilarSet | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const prompt = useMemo(
    () =>
      buildAiEmployeeOfficialPrompt({
        officialTest,
        count,
        skill: skill || undefined,
        module: module === "1" || module === "2" ? (Number(module) as 1 | 2) : undefined,
        skillNote: skillNote || undefined,
      }),
    [officialTest, count, skill, module, skillNote],
  );

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt.combined);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
      setErrorAr("تعذّر النسخ إلى الحافظة.");
    }
  };

  const run = async () => {
    setBusy(true);
    setError(undefined);
    setErrorAr(undefined);
    try {
      await navigator.clipboard.writeText(prompt.combined).catch(() => undefined);
      const response = await fetch("/api/exams/generate-from-official", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          officialTest,
          count,
          skill: skill || undefined,
          module: module === "1" || module === "2" ? Number(module) : undefined,
          skillNote: skillNote || undefined,
          save: true,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        set?: GeneratedSimilarSet;
        error?: string;
        errorAr?: string;
        tag?: string;
      };
      if (!response.ok || !payload.set) {
        setError(payload.error || "Could not generate from official style.");
        setErrorAr(payload.errorAr);
        return;
      }
      setResult(payload.set);
      setRevealed({});
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Network error while generating.");
      setErrorAr("خطأ في الشبكة أثناء التوليد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" style={{ marginBottom: compact ? 16 : 24 }}>
      <h2 style={{ marginTop: 0 }} dir="rtl">
        أمر لموظف الذكاء الاصطناعي
      </h2>
      <p className="muted" dir="rtl">
        أمر جاهز لإنشاء أسئلة أصلية على نسق النموذج الرسمي College Board (بدون نسخ الأسئلة). انسخ الأمر أو شغّله
        مباشرة.
      </p>
      <p className="muted" dir="ltr">
        Ready prompt for the AI employee — original items tagged{" "}
        <code>official-sat-style-{officialTest}</code>. Links only to CB PDFs; no CB text stored.
      </p>

      <div className="row" style={{ flexWrap: "wrap", gap: 12, marginTop: 12 }}>
        <label>
          Official test · النموذج
          <select
            value={officialTest}
            onChange={(e) => setOfficialTest(Number(e.target.value) as OfficialSatTestNumber)}
            style={{ display: "block", marginTop: 4 }}
          >
            {OFFICIAL_SAT_LINKS.map((link) => (
              <option key={link.test} value={link.test}>
                #{link.test}
              </option>
            ))}
          </select>
        </label>
        <label>
          Count · العدد
          <input
            type="number"
            min={1}
            max={6}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(6, Number(e.target.value) || 3)))}
            style={{ display: "block", marginTop: 4, width: 72 }}
          />
        </label>
        <label>
          Module
          <select
            value={module}
            onChange={(e) => setModule(e.target.value as "" | "1" | "2")}
            style={{ display: "block", marginTop: 4 }}
          >
            <option value="">Any</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <label>
          Skill · مهارة
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            style={{ display: "block", marginTop: 4, minWidth: 160 }}
          >
            <option value="">Mixed / متنوعة</option>
            {SKILL_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: "block", marginTop: 12 }}>
        Teacher skill note (optional) · ملاحظة المعلّم
        <input
          type="text"
          value={skillNote}
          onChange={(e) => setSkillNote(e.target.value)}
          placeholder="e.g. systems with word context / جمل بمعادلات"
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>

      <pre
        dir="auto"
        style={{
          whiteSpace: "pre-wrap",
          background: "var(--mm-surface-2, #f4f6f8)",
          padding: 12,
          borderRadius: 8,
          marginTop: 12,
          fontSize: "0.88rem",
          maxHeight: compact ? 140 : 220,
          overflow: "auto",
        }}
      >
        {prompt.combined}
      </pre>

      <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        <button className="btn" type="button" onClick={() => void copyPrompt()}>
          {copied ? "Copied · تم النسخ" : "Copy prompt · نسخ الأمر"}
        </button>
        <button className="btn dark" type="button" disabled={busy} onClick={() => void run()}>
          {busy ? "Generating…" : "Run AI employee · نفّذ التوليد"}
        </button>
        {set?.tag ? <span className="badge">{set.tag}</span> : null}
      </div>

      <ApiErrorBanner error={error} errorAr={errorAr} />
      {busy ? <SkeletonBlock lines={3} label="AI employee generating official-style items…" /> : null}

      {set ? (
        <div style={{ marginTop: 12 }}>
          <p className="muted">
            Set {set.id} · {set.questions.length} original items · {set.source} · saved for review
          </p>
          {set.questions.map((q, index) => (
            <OfficialGenCard
              key={q.id}
              question={q}
              index={index + 1}
              revealed={Boolean(revealed[q.id])}
              onReveal={() => setRevealed((current) => ({ ...current, [q.id]: true }))}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function OfficialGenCard({
  question,
  index,
  revealed,
  onReveal,
}: {
  question: GeneratedSimilarQuestion;
  index: number;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <article className="card" style={{ marginTop: 10 }}>
      <span className="badge">
        #{index} · {question.skill} · {question.responseType}
        {question.tag ? ` · ${question.tag}` : ""}
      </span>
      <p>
        <MixedMathText text={question.prompt} />
      </p>
      {question.latex ? <Katex tex={question.latex} display /> : null}
      {question.choices?.length ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {question.choices.map((choice) => (
            <li key={choice.id} style={{ marginBottom: 6 }}>
              <strong>{choice.id}.</strong> <MixedMathText text={choice.text} />
            </li>
          ))}
        </ul>
      ) : null}
      <button className="btn" type="button" onClick={onReveal}>
        {revealed ? "Answer shown" : "Show answer / solution"}
      </button>
      {revealed ? (
        <div style={{ marginTop: 8 }}>
          <p>
            <strong>Answer:</strong> {question.correctAnswer}
          </p>
          <p>
            <MixedMathText text={question.solution} />
          </p>
        </div>
      ) : null}
    </article>
  );
}
