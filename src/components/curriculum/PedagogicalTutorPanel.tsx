"use client";

import Link from "next/link";
import { useState } from "react";
import { Katex } from "@/components/studio/Katex";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import type { PedagogicalTutorResult, TutorMode } from "@/lib/curriculum/tutorTypes";
import { useCurriculum } from "./CurriculumProvider";

type TutorResponse = PedagogicalTutorResult | { error?: string; errorAr?: string };

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [800, 1600] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendlyHardFailure(status: number | null, network: boolean): { error: string; errorAr: string } {
  if (network) {
    return {
      error: "Network error. Please retry.",
      errorAr: "خطأ في الشبكة. أعد المحاولة…",
    };
  }
  if (status === 504 || status === 408) {
    return {
      error: "Request timed out. Please retry.",
      errorAr: "انتهت مهلة الطلب… أعد المحاولة.",
    };
  }
  if (status === 502 || status === 503) {
    return {
      error: "Server busy. Please retry.",
      errorAr: "الخادم مشغول، أعد المحاولة…",
    };
  }
  return {
    error: "Tutor request failed.",
    errorAr: "تعذّر طلب المعلّم.",
  };
}

export function PedagogicalTutorPanel() {
  const { curriculumId, curriculum, terminology, ready } = useCurriculum();
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
            setErrorAr("إعادة المحاولة…");
            setError("Retrying…");
            await sleep(BACKOFF_MS[attempt - 1] ?? 1600);
            continue;
          }

          if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
            if (response.status === 403) {
              const fail = (payload ?? {}) as { error?: string; errorAr?: string };
              setError(fail.error ?? "AI_TIER or BOTH required. Redeem a code to unlock.");
              setErrorAr(fail.errorAr ?? "يلزم اشتراك الذكاء. فعّل كوداً على /redeem.");
              lastFail = fail;
              return;
            }
            if (shouldRetry || nonJson) {
              const friendly = friendlyHardFailure(response.status, false);
              setError(friendly.error);
              setErrorAr(friendly.errorAr);
            } else {
              const fail = (payload ?? {}) as { error?: string; errorAr?: string };
              lastFail = fail;
              setError(fail.error ?? "Tutor request failed.");
              setErrorAr(fail.errorAr ?? "تعذّر طلب المعلّم.");
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
            setErrorAr("إعادة المحاولة…");
            setError("Retrying…");
            await sleep(BACKOFF_MS[attempt - 1] ?? 1600);
            continue;
          }
          const friendly = friendlyHardFailure(lastStatus, true);
          setError(friendly.error);
          setErrorAr(friendly.errorAr);
          return;
        }
      }

      if (lastFail) {
        setError(lastFail.error ?? "Tutor request failed.");
        setErrorAr(lastFail.errorAr ?? "تعذّر طلب المعلّم.");
      } else {
        const friendly = friendlyHardFailure(lastStatus, networkFail);
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
      <p className="eyebrow">المعلّم الذكي</p>
      <h2>تعلّم الحل خطوة بخطوة</h2>
      <p className="muted">
        منهج {curriculum.labelAr} · {terminology.derivative.ar} · {terminology.limits.ar}
      </p>
      <p className="muted">
        «مباشر»: حل كامل مع التبرير. «سقراطي»: تلميحات متدرّجة لتصل إلى الحل بنفسك، ولا يظهر الجواب النهائي إلا إذا
        طلبته.
      </p>

      <label className="mm-field">
        <span>المسألة</span>
        <textarea
          dir="auto"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="اكتب المسألة هنا"
        />
      </label>
      <label className="mm-field">
        <span>
          صيغة <bdi dir="ltr">LaTeX</bdi> (اختياري)
        </span>
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
          <span>الأسلوب</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as TutorMode)}>
            <option value="direct">مباشر</option>
            <option value="socratic">سقراطي (تلميحات)</option>
          </select>
        </label>
        <label className="mm-field">
          <span>لغة الشرح</span>
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
          اكشف الجواب النهائي
        </label>
      ) : null}

      <ApiErrorBanner error={error} errorAr={errorAr} />
      {error && /AI_TIER|اشتراك الذكاء|subscription required/i.test(error + errorAr) ? (
        <p className="muted">
          <Link className="btn" href="/redeem?need=ai&next=%2Fmath-solver">
            فعّل اشتراك الحلّال
          </Link>
        </p>
      ) : null}
      {busy ? (
        <SkeletonBlock lines={4} label={retrying ? "إعادة المحاولة…" : "جارٍ التحضير…"} />
      ) : null}
      {retrying ? (
        <p className="muted" style={{ marginTop: 4 }}>
          إعادة المحاولة…
        </p>
      ) : null}

      <button className="btn dark" type="button" disabled={busy || !ready} onClick={() => void submit()}>
        {busy ? (retrying ? "إعادة المحاولة…" : "جارٍ التحضير…") : "اسأل المعلّم الذكي"}
      </button>

      {result ? (
        <div className="mm-tutor-result" style={{ marginTop: 16 }}>
          <p>
            <strong>الهدف:</strong> <span dir="auto">{result.curriculumObjective}</span>
          </p>
          <p>
            <strong>المتطلّب السابق:</strong> <span dir="auto">{result.prerequisiteConcept}</span>
          </p>
          {result.source === "demo" || result.warning || result.warningAr ? (
            <div className="mm-tutor-soft-notice" role="status">
              {language === "ar" ? (
                <>
                  <p dir="rtl" lang="ar">
                    {result.warningAr ||
                      "السيرفر تحت ضغط مؤقت، ويتم توليد نموذج تقريبي للتدريب. أعد المحاولة بعد لحظات للحصول على حل الذكاء الكامل."}
                  </p>
                  {result.warning ? (
                    <p dir="ltr" lang="en" className="mm-tutor-soft-notice-secondary">
                      {result.warning}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p dir="ltr" lang="en">
                    {result.warning ||
                      "The server is under temporary load, so an approximate practice model is shown. Try again in a moment for a full AI solution."}
                  </p>
                  {result.warningAr ? (
                    <p dir="rtl" lang="ar" className="mm-tutor-soft-notice-secondary">
                      {result.warningAr}
                    </p>
                  ) : null}
                </>
              )}
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
              <h3>تلميحات</h3>
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
            <h3>الجواب النهائي</h3>
            <p>{result.finalAnswer}</p>
            {result.finalAnswerLatex ? <Katex tex={result.finalAnswerLatex} display /> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
