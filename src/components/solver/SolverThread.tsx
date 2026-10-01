import { MathServer } from "@/components/ui/MathServer";
import { MixedMathServer } from "@/components/ui/MixedMathServer";
import { FunctionGraph } from "@/components/v2/FunctionGraph";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";
import { TutorOrb } from "@/components/v2/TutorOrb";
import { Reveal } from "@/components/v2/motion/Reveal";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import { buildGraph } from "@/lib/math/graph";
import { sampleExpression } from "@/lib/math/safeExpression";
import type { MathQueryRecord, SolverStep } from "@/lib/solver/types";

type Tri = { en?: string; fr?: string; ar?: string };

/** Pick the requested variant of AI content, falling back to English / whatever exists. */
function pick(lang: Locale, value: Tri): string {
  return (value[lang] || value.en || value.fr || value.ar || "").trim();
}

function stepText(step: SolverStep, lang: Locale) {
  return {
    title: pick(lang, { en: step.title, fr: step.titleFr, ar: step.titleAr }),
    body: pick(lang, { en: step.explanationEn, fr: step.explanationFr, ar: step.explanationAr }),
  };
}

/** Graph from the solver's `plotFunction` event, parsed by the safe evaluator (never `new Function`). */
function graphFor(query: MathQueryRecord) {
  const event = query.canvasTimeline?.events?.find((item) => item.type === "plotFunction" && typeof item.expression === "string");
  if (!event?.expression) return null;
  const [from, to] = Array.isArray(event.domain) && event.domain.length === 2 ? event.domain : [-5, 5];
  const points = sampleExpression(event.expression, Number(from), Number(to), 140);
  const graph = points ? buildGraph(points, 360, 210) : null;
  return graph ? { graph, latex: event.latex || query.given?.latex || "" } : null;
}

/**
 * Solver result as a conversation (server-rendered KaTeX): question → "I read" → key idea → steps →
 * graph → (needs review) → gold result card. Items fade in with a CSS stagger (static under reduced motion).
 * AI prose follows the solution language the student asked for (and the curriculum's answer style), not
 * the UI locale; chrome stays in the UI locale.
 */
export function SolverThread({ query, m, locale }: { query: MathQueryRecord; m: Messages; locale: Locale }) {
  const r = m.result;
  const lang: Locale = query.language ?? locale;
  const tip = query.examTip ? pick(lang, query.examTip) : query.summary;
  const aim = query.given ? pick(lang, { en: query.given.aimEn, fr: query.given.aimFr, ar: query.given.aimAr }) : "";
  const style = query.curriculum ? m.solver.curricula[query.curriculum] : "";
  const plotted = query.needsRetake ? null : graphFor(query);
  let index = 0;
  return (
    <div className="v2-thread">
      <Reveal index={index++} className="v2-bub me">
        {query.imageUrl ? <img className="v2-bub-photo" src={query.imageUrl} alt={m.solver.photoAlt} /> : null}
        <MixedMathServer as="p" text={query.question} />
      </Reveal>

      <Reveal index={index++} className="v2-thread-ai">
        <p className="v2-ai-head">
          <TutorOrb mini /> {r.read} <AiTutorBadge label={m.persona.ai} />
        </p>
        <div className="v2-bub ai">
          {query.given ? <MathServer tex={query.given.latex} display /> : <MixedMathServer as="p" text={query.question} />}
          {aim ? (
            <p dir="auto" lang={lang}>
              {aim}
            </p>
          ) : null}
        </div>
      </Reveal>

      {query.needsRetake ? (
        <Reveal index={index++} className="v2-step glass is-warn">
          <h3>{r.retakeTitle}</h3>
          <p dir="auto">{locale === "ar" ? query.retakeMessageAr || query.retakeMessageEn : query.retakeMessageEn || query.retakeMessageAr}</p>
        </Reveal>
      ) : (
        <>
          {tip ? (
            <Reveal index={index++} className="v2-keyidea">
              <span className="v2-keyidea-label">{r.keyIdea}</span>
              <p dir="auto" lang={lang}>
                {tip}
              </p>
            </Reveal>
          ) : null}

          {style ? (
            <Reveal index={index++} className="v2-style-chip-row">
              <span className="v2-chip v2-style-chip">{fmt(r.style, { style })}</span>
            </Reveal>
          ) : null}

          <section aria-label={r.steps} className="v2-steps">
            {query.steps.map((step, stepIndex) => {
              const text = stepText(step, lang);
              return (
                <Reveal key={`${step.title}-${stepIndex}`} index={index++} className={`v2-step glass${step.boxed ? " is-boxed" : ""}`}>
                  <p className="v2-step-n">{fmt(r.step, { n: stepIndex + 1 })}</p>
                  <h3 dir="auto" lang={lang}>
                    {text.title}
                  </h3>
                  {step.latex ? <MathServer tex={step.latex} display /> : null}
                  {text.body ? (
                    <p dir="auto" lang={lang}>
                      {text.body}
                    </p>
                  ) : null}
                </Reveal>
              );
            })}
          </section>

          {plotted ? (
            <Reveal index={index++} className="v2-step glass">
              <p className="v2-step-n">{r.graph}</p>
              <FunctionGraph
                graph={plotted.graph}
                ariaLabel={fmt(r.graphAria, { f: plotted.latex || "f" })}
                caption={plotted.latex ? <MathServer tex={plotted.latex} /> : undefined}
              />
            </Reveal>
          ) : null}

          {query.needsReview ? (
            <Reveal index={index++} className="v2-step glass is-warn v2-review">
              <h3>
                <span aria-hidden="true">⚠️ </span>
                {r.reviewTitle}
              </h3>
              <p>{r.reviewBody}</p>
            </Reveal>
          ) : null}

          <Reveal index={index++} className={`v2-result${query.needsReview ? " is-review" : ""}`}>
            <span className="v2-result-label">
              {r.result}
              {query.needsReview ? ` · ${r.reviewTitle}` : ""}
            </span>
            <MathServer tex={query.finalAnswerLatex || query.finalAnswer} display />
            {query.finalAnswer && query.finalAnswerLatex ? <MixedMathServer as="p" text={query.finalAnswer} /> : null}
          </Reveal>
          {query.warning ? <p className="v2-muted v2-small">{query.warning}</p> : null}
        </>
      )}
    </div>
  );
}
