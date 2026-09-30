"use client";

import Link from "next/link";
import { useState } from "react";
import { Katex } from "@/components/studio/Katex";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import type { PedagogicalTutorResult, TutorMode } from "@/lib/curriculum/tutorTypes";
import { useCurriculum } from "./CurriculumProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { tutorMessages, type TutorMessages } from "@/lib/i18n/ns/tutor";
import { rich } from "@/lib/i18n/rich";

type TutorResponse = PedagogicalTutorResult | { error?: string; errorAr?: string };

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [800, 1600] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Client-side failures: the active locale's text in both slots (ApiErrorBanner picks errorAr for ar). */
function friendlyHardFailure(
  status: number | null,
  network: boolean,
  e: TutorMessages["errors"],
): { error: string; errorAr: string } {
  const text = network
    ? e.network
    : status === 504 || status === 408
      ? e.timeout
      : status === 502 || status === 503
        ? e.busy
        : e.failed;
  return { error: text, errorAr: text };
}

export function PedagogicalTutorPanel() {
  const { curriculumId, curriculum, terminology, ready } = useCurriculum();
  const { locale } = useI18n();
  const t = tutorMessages[locale];
  const term = (entry: { en: string; ar: string }) => (locale === "ar" ? entry.ar : entry.en);
  const [text, setText] = useState("");
  const [latex, setLatex] = useState("");
  const [mode, setMode] = useState<TutorMode>("direct");
  const [language, setLanguage] = useState<"ar" | "en">(curriculum.defaultLanguage);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [errorAr, setErrorAr] = useState("");
  const [result, setResult] = useState<PedagogicalTutorResult | null>(null);

  const submit = async () => {
    setBusy(true);
    setRetrying(false);
    setError("");
    setErrorAr("");
    setResult(null);

    const body = JSON.stringify({
      text,
      latex: latex ? formatLebaneseEquation(latex) : undefined,
      mode,
      curriculumId,
      language,
      revealAnswer: mode === "socratic" ? revealAnswer : true,
    });

    let lastStatus: number | null = null;
    let lastFail: { error?: string; errorAr?: string } | null = null;
    let networkFail = false;

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const response = await fetch("/api/ai/pedagogical-tutor", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body,
          });
          lastStatus = response.status;

          const raw = await response.text();
          let payload: TutorResponse | null = null;
          let nonJson = false;
          try {
            payload = raw ? (JSON.parse(raw) as TutorResponse) : null;
          } catch {
            nonJson = true;
            payload = null;
          }

          const gatewayStatus =
            response.status === 502 || response.status === 503 || response.status === 504;
          const netlifyCrash =
            !!payload &&
            typeof payload === "object" &&
            "errorType" in (payload as object) &&
            !("ok" in (payload as object));
          const shouldRetry = gatewayStatus || nonJson || !raw || netlifyCrash;

          if (shouldRetry && attempt < MAX_ATTEMPTS) {
            setRetrying(true);
            setErrorAr(t.retrying);
            setError(t.retrying);
            await sleep(BACKOFF_MS[attempt - 1] ?? 1600);
            continue;
          }

          if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
            if (response.status === 403) {
              const fail = (payload ?? {}) as { error?: string; errorAr?: string };
              setError(fail.error ?? `AI_TIER · ${t.errors.tier}`);
              setErrorAr(fail.errorAr ?? t.errors.tier);
              lastFail = fail;
              return;
            }
            if (shouldRetry || nonJson) {
              const friendly = friendlyHardFailure(response.status, false, t.errors);
              setError(friendly.error);
              setErrorAr(friendly.errorAr);
            } else {
              const fail = (payload ?? {}) as { error?: string; errorAr?: string };
              lastFail = fail;
              setError(fail.error ?? t.errors.failed);
              setErrorAr(fail.errorAr ?? t.errors.failed);
            }
            return;
          }

          // ok + demo with warning still shows result.
          setResult(payload);
          setError("");
          setErrorAr("");
          return;
        } catch {
          networkFail = true;
          if (attempt < MAX_ATTEMPTS) {
            setRetrying(true);
            setErrorAr(t.retrying);
            setError(t.retrying);
            await sleep(BACKOFF_MS[attempt - 1] ?? 1600);
            continue;
          }
          const friendly = friendlyHardFailure(lastStatus, true, t.errors);
          setError(friendly.error);
          setErrorAr(friendly.errorAr);
          return;
        }
      }

      if (lastFail) {
        setError(lastFail.error ?? t.errors.failed);
        setErrorAr(lastFail.errorAr ?? t.errors.failed);
      } else {
        const friendly = friendlyHardFailure(lastStatus, networkFail, t.errors);
        setError(friendly.error);
        setErrorAr(friendly.errorAr);
      }
    } finally {
      setBusy(false);
      setRetrying(false);
    }
  };

  return (
    <section className="card mm-tutor-panel mm-mobile-stack" style={{ marginTop: 20 }}>
      <p className="eyebrow">{t.eyebrow}</p>
      <h2>{t.title}</h2>
      <p className="muted">
        {fmt(t.curriculumLine, {
          curriculum: locale === "ar" ? curriculum.labelAr : curriculum.labelEn,
          derivative: term(terminology.derivative),
          limits: term(terminology.limits),
        })}
      </p>
      <p className="muted">
        {t.modesHelp}
      </p>

      <label className="mm-field">
        <span>{t.problem}</span>
        <textarea
          dir="auto"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t.problemPh}
        />
      </label>
      <label className="mm-field">
        <span>{rich(t.latexLabel, { latex: <bdi dir="ltr">LaTeX</bdi> })}</span>
        <input
          dir="ltr"
          value={latex}
          onChange={(event) => setLatex(formatLebaneseEquation(event.target.value))}
        />
      </label>
      {latex ? (
        <p className="latex-preview">
          <Katex tex={latex} display />
        </p>
      ) : null}

      <div className="grid two">
        <label className="mm-field">
          <span>{t.mode}</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as TutorMode)}>
            <option value="direct">{t.direct}</option>
            <option value="socratic">{t.socratic}</option>
          </select>
        </label>
        <label className="mm-field">
          <span>{t.explanationLanguage}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as "ar" | "en")}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      {mode === "socratic" ? (
        <label className="row" style={{ alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={revealAnswer}
            onChange={(event) => setRevealAnswer(event.target.checked)}
          />
          {t.revealAnswer}
        </label>
      ) : null}

      <ApiErrorBanner error={error} errorAr={errorAr} />
      {error && /AI_TIER|اشتراك الذكاء|subscription required/i.test(error + errorAr) ? (
        <p className="muted">
          <Link className="btn" href="/redeem?need=ai&next=%2Fmath-solver">
            {t.unlock}
          </Link>
        </p>
      ) : null}
      {busy ? (
        <SkeletonBlock lines={4} label={retrying ? t.retrying : t.preparing} />
      ) : null}
      {retrying ? (
        <p className="muted" style={{ marginTop: 4 }}>
          {t.retrying}
        </p>
      ) : null}

      <button className="btn dark" type="button" disabled={busy || !ready} onClick={() => void submit()}>
        {busy ? (retrying ? t.retrying : t.preparing) : t.ask}
      </button>

      {result ? (
        <div className="mm-tutor-result" style={{ marginTop: 16 }}>
          <p>
            <strong>{t.objective}</strong> <span dir="auto">{result.curriculumObjective}</span>
          </p>
          <p>
            <strong>{t.prerequisite}</strong> <span dir="auto">{result.prerequisiteConcept}</span>
          </p>
          {result.source === "demo" || result.warning || result.warningAr ? (
            <div className="mm-tutor-soft-notice" role="status">
              <p>
                {locale === "ar"
                  ? result.warningAr || t.demoNotice
                  : locale === "fr"
                    ? t.demoNotice
                    : result.warning || t.demoNotice}
              </p>
            </div>
          ) : null}
          <ol>
            {result.steps.map((step, index) => (
              <li key={`${step.title}-${index}`}>
                <strong>{step.title}</strong> — {step.justification}
                {step.latex ? (
                  <span className="latex-preview">
                    <Katex tex={step.latex} display />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {result.hints.length > 0 ? (
            <div>
              <h3>{t.hints}</h3>
              <ul>
                {result.hints.map((hint) => (
                  <li key={hint.level}>
                    L{hint.level}: {hint.text}
                    {hint.latex ? (
                      <span className="latex-preview">
                        <Katex tex={hint.latex} />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mm-tutor-final">
            <h3>{t.finalAnswer}</h3>
            <p>{result.finalAnswer}</p>
            {result.finalAnswerLatex ? <Katex tex={result.finalAnswerLatex} display /> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
