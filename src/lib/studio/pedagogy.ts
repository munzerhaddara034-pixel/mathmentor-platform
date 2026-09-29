import { L } from "./i18n";
import {
  DEFAULT_EXAM_TIP,
  DEFAULT_VARIATION_TABLE,
  INSTRUCTOR_EN,
} from "@/lib/pedagogy/lebanese";
import {
  REQUIRED_PHASES,
  hasBoxedAnswer,
  hasDomainStatement,
  hasExamTip,
  hasGradedExample,
  hasLimitsAsymptotes,
  hasRenderGraph,
  hasStepByStep,
  hasVariationTable,
  normalizedActionType,
  type CanvasAction,
  type LessonPhase,
  type LessonSegment,
  type LessonTimeline,
  type LessonLanguage,
} from "./timeline";

const PHASE_DURATION: Record<LessonPhase, number> = {
  introduction: 55,
  rule_graph: 120,
  real_example: 160,
  common_mistake: 45,
};

function bilingual(en: string, fr: string) {
  return L(en, fr);
}

function shiftActions(actions: CanvasAction[], extra = 0): CanvasAction[] {
  return actions.map((action) => ({ ...action, at: action.at + extra }));
}

function mergePhaseSegments(items: LessonSegment[], phase: LessonPhase, start: number, end: number): LessonSegment {
  const first = items[0];
  const actions: CanvasAction[] = [];
  let cursor = 0;
  const narrationsEn: string[] = [];
  const narrationsFr: string[] = [];
  for (const item of items) {
    const duration = Math.max(8, item.end - item.start);
    actions.push(
      ...item.canvas.actions.map((action) => ({
        ...action,
        at: Math.min(action.at + cursor, Math.max(0, end - start - 1)),
      })),
    );
    if (item.narration?.en) narrationsEn.push(item.narration.en);
    if (item.narration?.fr) narrationsFr.push(item.narration.fr);
    cursor += duration;
  }
  return {
    ...first,
    start,
    end,
    phase,
    avatar: {
      state: phase === "rule_graph" ? "paused" : first.avatar.state,
    },
    narration: bilingual(narrationsEn.join(" "), narrationsFr.join(" ") || narrationsEn.join(" ")),
    canvas: { actions },
  };
}

export function ensurePedagogy(timeline: LessonTimeline): LessonTimeline {
  const byPhase = new Map<LessonPhase, LessonSegment[]>();
  for (const segment of timeline.segments) {
    const list = byPhase.get(segment.phase) ?? [];
    list.push(segment);
    byPhase.set(segment.phase, list);
  }

  let cursor = 0;
  const segments: LessonSegment[] = REQUIRED_PHASES.map((phase) => {
    const existing = byPhase.get(phase) ?? [];
    const duration = existing.length
      ? Math.max(
          PHASE_DURATION[phase] * 0.4,
          existing.reduce((sum, item) => sum + Math.max(8, item.end - item.start), 0),
        )
      : PHASE_DURATION[phase];
    const start = cursor;
    const end = cursor + duration;
    cursor = end;

    if (existing.length) {
      return mergePhaseSegments(existing, phase, start, end);
    }
    return placeholderSegment(phase, start, end, timeline.language, timeline.title.en);
  });

  const next: LessonTimeline = {
    ...timeline,
    instructor: timeline.instructor || INSTRUCTOR_EN,
    durationSec: cursor,
    segments,
  };

  injectOfficialSequence(next);

  const rule = next.segments.find((segment) => segment.phase === "rule_graph")!;
  if (!hasRenderGraph(next)) {
    rule.canvas.actions.push({
      at: Math.min(88, Math.max(1, rule.end - rule.start - 2)),
      type: "plotFunction",
      payload: {
        kind: "function",
        fn: "exp(x)",
        xDomain: [-2, 2],
        yDomain: [-1, 8],
        title: bilingual("Mandatory graph C_f", "Graphe obligatoire C_f"),
      },
    });
  }

  const example = next.segments.find((segment) => segment.phase === "real_example")!;
  const existingSteps = example.canvas.actions.filter((action) => {
    const type = normalizedActionType(action.type);
    return type === "show_step" || type === "boxAnswer" || type === "variationTable";
  }).length;
  if (existingSteps < 3) {
    const fillers: CanvasAction[] = [
      {
        at: 8,
        type: "show_step",
        payload: {
          latex: "D_f\\text{ first, then the hypothesis}",
          math_latex: "D_f\\text{ first, then the hypothesis}",
          step_en: "Step 1 — copy the given and write D_f (or the geometric hypothesis) before any formula.",
          step_fr: "Étape 1 — recopier les données et écrire D_f (ou l’hypothèse géométrique) avant toute formule.",
          text: bilingual(
            "Step 1 — copy the given and write D_f (or the geometric hypothesis) before any formula.",
            "Étape 1 — recopier les données et écrire D_f (ou l’hypothèse géométrique) avant toute formule.",
          ),
        },
      },
      {
        at: 36,
        type: "show_step",
        payload: {
          latex: "\\text{algebra: expand / factor / substitute}",
          math_latex: "\\text{algebra: expand / factor / substitute}",
          step_en: "Step 2 — every algebra line (expand, factor, substitute). Name the theorem. No skipped equals.",
          step_fr: "Étape 2 — chaque ligne d’algèbre (développer, factoriser, substituer). Nommer le théorème. Aucune égalité sautée.",
          text: bilingual(
            "Step 2 — every algebra line (expand, factor, substitute). Name the theorem. No skipped equals.",
            "Étape 2 — chaque ligne d’algèbre (développer, factoriser, substituer). Nommer le théorème. Aucune égalité sautée.",
          ),
        },
      },
      {
        at: 70,
        type: "boxAnswer",
        payload: {
          latex: "\\boxed{\\text{conclusion}}",
          math_latex: "\\boxed{\\text{conclusion}}",
          step_en: "Step 3 — box the conclusion the marker wants (barème). Substitute back if a check is possible.",
          step_fr: "Étape 3 — encadrer la conclusion du barème. Substituer pour vérifier si c’est possible.",
          text: bilingual(
            "Step 3 — box the conclusion the marker wants (barème). Substitute back if a check is possible.",
            "Étape 3 — encadrer la conclusion du barème. Substituer pour vérifier si c’est possible.",
          ),
          marks: "official sub-question",
        },
      },
    ];
    for (const extra of fillers.slice(existingSteps)) {
      example.canvas.actions.push(extra);
    }
  }

  if (!hasBoxedAnswer(next)) {
    example.canvas.actions.push({
      at: Math.max(4, example.end - example.start - 8),
      type: "boxAnswer",
      payload: {
        latex: "\\boxed{\\text{final answer}}",
        math_latex: "\\boxed{\\text{final answer}}",
        step_en: "Boxed Final Answer — one box per sub-question, aligned to the barème.",
        step_fr: "Réponse encadrée — un cadre par sous-question, aligné sur le barème.",
        text: bilingual(
          "Boxed Final Answer — one box per sub-question, aligned to the barème.",
          "Réponse encadrée — un cadre par sous-question, aligné sur le barème.",
        ),
      },
    });
  }

  next.chapters = ensureStudyChapters(next);

  if (!hasRenderGraph(next) || !hasStepByStep(next) || !hasGradedExample(next)) {
    throw new Error("Pedagogy repair failed: missing graph, or fewer than 3 graded example steps.");
  }

  return next;
}

function injectOfficialSequence(timeline: LessonTimeline) {
  const intro = timeline.segments.find((segment) => segment.phase === "introduction")!;
  const rule = timeline.segments.find((segment) => segment.phase === "rule_graph")!;
  const trap = timeline.segments.find((segment) => segment.phase === "common_mistake")!;

  if (!hasExamTip(timeline)) {
    intro.canvas.actions.unshift({
      at: 1,
      type: "exam_tip",
      payload: {
        latex: "\\text{Key Idea / Exam Tip}",
        math_latex: "\\text{Key Idea / Exam Tip}",
        caption: bilingual("Key Idea / Exam Tip", "Idée clé / Conseil d’épreuve"),
        step_en: DEFAULT_EXAM_TIP.en,
        step_fr: DEFAULT_EXAM_TIP.fr,
        text: bilingual(DEFAULT_EXAM_TIP.en, DEFAULT_EXAM_TIP.fr),
      },
    });
    intro.narration = bilingual(
      `${DEFAULT_EXAM_TIP.en} ${intro.narration.en}`,
      `${DEFAULT_EXAM_TIP.fr} ${intro.narration.fr ?? intro.narration.en}`,
    );
  }

  if (!hasDomainStatement(timeline)) {
    intro.canvas.actions.push({
      at: Math.min(18, Math.max(8, intro.end - intro.start - 6)),
      type: "renderMath",
      payload: {
        latex: "D_f=\\mathbb{R}",
        math_latex: "D_f=\\mathbb{R}",
        caption: bilingual("Domain of definition (first)", "Ensemble de définition (d’abord)"),
        step_en: "Write D_f before any limit or derivative. Justify from the expressions that appear.",
        step_fr: "Écrire D_f avant toute limite ou dérivée. Justifier à partir des expressions présentes.",
      },
    });
  }

  if (!hasLimitsAsymptotes(timeline)) {
    rule.canvas.actions.unshift({
      at: 4,
      type: "show_step",
      payload: {
        latex: "\\lim_{x\\to\\pm\\infty}f(x)\\quad\\text{then }y=b\\text{ or }x=a\\text{ or }y=ax+b",
        math_latex: "\\lim_{x\\to\\pm\\infty}f(x)\\quad\\text{then }y=b\\text{ or }x=a\\text{ or }y=ax+b",
        step_en: "Calculate limits at the boundaries. Write the asymptote equation: x=a, y=b, or y=ax+b. Never leave (−∞)×0.",
        step_fr: "Calculer les limites aux bornes. Écrire l’équation d’asymptote : x=a, y=b ou y=ax+b. Ne jamais laisser (−∞)×0.",
        text: bilingual(
          "Calculate limits at the boundaries. Write the asymptote equation: x=a, y=b, or y=ax+b. Never leave (−∞)×0.",
          "Calculer les limites aux bornes. Écrire l’équation d’asymptote : x=a, y=b ou y=ax+b. Ne jamais laisser (−∞)×0.",
        ),
      },
    });
  }

  if (!hasVariationTable(timeline)) {
    rule.canvas.actions.push({
      at: Math.min(48, Math.max(20, (rule.end - rule.start) / 2)),
      type: "variationTable",
      payload: {
        latex: DEFAULT_VARIATION_TABLE,
        math_latex: DEFAULT_VARIATION_TABLE,
        step_en: "Table of variations: arrows, limits, and images — not only the sign of f'.",
        step_fr: "Tableau de variation : flèches, limites et images — pas seulement le signe de f'.",
        text: bilingual(
          "Table of variations: arrows, limits, and images — not only the sign of f'.",
          "Tableau de variation : flèches, limites et images — pas seulement le signe de f'.",
        ),
      },
    });
  }

  const hasPitfallNarration = /pitfall|piège|trap|barème|bareme/i.test(
    `${trap.narration.en} ${trap.narration.fr ?? ""}`,
  );
  if (!hasPitfallNarration) {
    trap.narration = bilingual(
      `Common pitfalls that lose barème marks: ${trap.narration.en}`,
      `Pièges fréquents qui font perdre des points au barème : ${trap.narration.fr ?? trap.narration.en}`,
    );
  }
}

function ensureStudyChapters(timeline: LessonTimeline) {
  const intro = timeline.segments.find((s) => s.phase === "introduction")!;
  const rule = timeline.segments.find((s) => s.phase === "rule_graph")!;
  const example = timeline.segments.find((s) => s.phase === "real_example")!;
  const trap = timeline.segments.find((s) => s.phase === "common_mistake")!;
  const existing = timeline.chapters ?? [];
  const required = [
    { id: "intro", at: intro.start, label: bilingual("Key Idea / Exam Tip", "Idée clé / Conseil d’épreuve") },
    { id: "domain", at: intro.start + Math.min(18, (intro.end - intro.start) / 3), label: bilingual("Domain D_f", "Ensemble D_f") },
    { id: "limits", at: rule.start, label: bilingual("Limits & asymptotes", "Limites et asymptotes") },
    {
      id: "variation",
      at: rule.start + Math.min(50, (rule.end - rule.start) / 2),
      label: bilingual("Derivative / variation", "Dérivée / variation"),
    },
    {
      id: "graph",
      at: rule.start + Math.min(90, (2 * (rule.end - rule.start)) / 3),
      label: bilingual("Points & graph", "Points et graphe"),
    },
    { id: "example", at: example.start, label: bilingual("Boxed exercise", "Exercice encadré") },
    { id: "mistake", at: trap.start, label: bilingual("Common pitfalls", "Pièges fréquents") },
  ];
  const ids = new Set(existing.map((chapter) => chapter.id));
  const merged = [...existing];
  for (const chapter of required) {
    if (!ids.has(chapter.id)) merged.push(chapter);
  }
  return merged.sort((a, b) => a.at - b.at);
}

function placeholderSegment(
  phase: LessonPhase,
  start: number,
  end: number,
  _language: LessonLanguage,
  topic: string,
): LessonSegment {
  const id = `${phase}-${start}`;
  if (phase === "introduction") {
    return {
      id,
      start,
      end,
      phase,
      avatar: { state: "speaking" },
      narration: bilingual(
        `${DEFAULT_EXAM_TIP.en} We define ${topic} as it appears in Lebanese official exams (Brevet / Terminale LS, GS, SE). Domain D_f first.`,
        `${DEFAULT_EXAM_TIP.fr} Nous définissons ${topic} tel qu’il apparaît dans les examens officiels libanais (Brevet / Terminale LS, GS, SE). D_f d’abord.`,
      ),
      canvas: {
        actions: [
          {
            at: 1,
            type: "exam_tip",
            payload: {
              latex: "\\text{Key Idea / Exam Tip}",
              caption: bilingual("Key Idea / Exam Tip", "Idée clé / Conseil d’épreuve"),
              step_en: DEFAULT_EXAM_TIP.en,
              step_fr: DEFAULT_EXAM_TIP.fr,
              text: bilingual(DEFAULT_EXAM_TIP.en, DEFAULT_EXAM_TIP.fr),
            },
          },
          {
            at: 16,
            type: "renderMath",
            payload: {
              latex: "D_f=\\mathbb{R}",
              caption: bilingual("Domain of definition", "Ensemble de définition"),
            },
          },
        ],
      },
    };
  }
  if (phase === "rule_graph") {
    return {
      id,
      start,
      end,
      phase,
      avatar: { state: "paused" },
      narration: bilingual(
        "Look at the board. Limits at the boundaries, then the asymptote equations, then f' and the table of variations, then C_f.",
        "Regardez le tableau. Limites aux bornes, puis les équations d’asymptotes, puis f' et le tableau de variation, puis C_f.",
      ),
      canvas: {
        actions: [
          {
            at: 4,
            type: "show_step",
            payload: {
              latex: "\\lim_{x\\to-\\infty}f(x)=0,\\quad y=0",
              step_en: "Horizontal asymptote y=0. Write the equation, not only the word “asymptote”.",
              step_fr: "Asymptote horizontale y=0. Écrire l’équation, pas seulement le mot « asymptote ».",
              text: bilingual(
                "Horizontal asymptote y=0. Write the equation, not only the word “asymptote”.",
                "Asymptote horizontale y=0. Écrire l’équation, pas seulement le mot « asymptote ».",
              ),
            },
          },
          {
            at: 28,
            type: "variationTable",
            payload: {
              latex: DEFAULT_VARIATION_TABLE,
              math_latex: DEFAULT_VARIATION_TABLE,
              step_en: "Table of variations with arrows, limits, and images.",
              step_fr: "Tableau de variation avec flèches, limites et images.",
            },
          },
          {
            at: 70,
            type: "plotFunction",
            payload: {
              kind: "function",
              fn: "exp(x)",
              xDomain: [-2, 2],
              yDomain: [-1, 8],
              title: bilingual("Mandatory graph C_f", "Graphe obligatoire C_f"),
            },
          },
        ],
      },
    };
  }
  if (phase === "real_example") {
    return {
      id,
      start,
      end,
      phase,
      avatar: { state: "speaking" },
      narration: bilingual(
        `A full worked example on ${topic} with substitution, IVT only after continuity and monotonicity, and a boxed answer.`,
        `Un exemple entièrement résolu sur ${topic} avec substitution, TVI seulement après continuité et monotonie, et une réponse encadrée.`,
      ),
      canvas: {
        actions: [
          {
            at: 4,
            type: "show_step",
            payload: {
              latex: "\\text{Step 1 — given and }D_f",
              text: bilingual("Copy the given and the domain.", "Recopiez les données et l’ensemble de définition."),
            },
          },
          {
            at: 20,
            type: "show_step",
            payload: {
              latex: "\\text{Step 2 — algebra}",
              text: bilingual("Expand, factor, or substitute. No skipped line.", "Développez, factorisez ou substituez. Aucune ligne sautée."),
            },
          },
          {
            at: 40,
            type: "boxAnswer",
            payload: {
              latex: "\\boxed{\\text{conclusion}}",
              text: bilingual("Box the conclusion the marker wants.", "Encadrez la conclusion du barème."),
            },
          },
        ],
      },
    };
  }
  return {
    id,
    start,
    end,
    phase,
    avatar: { state: "speaking" },
    narration: bilingual(
      "Common pitfalls that lose barème marks: quoting a formula before its hypothesis.",
      "Pièges fréquents qui font perdre des points au barème : citer une formule avant son hypothèse.",
    ),
    canvas: {
      actions: [
        {
          at: 3,
          type: "show_equation",
          payload: {
            latex: "\\text{Hypothesis first, then the formula.}",
            caption: bilingual("Common pitfalls", "Pièges fréquents"),
          },
        },
      ],
    },
  };
}

export { shiftActions, PHASE_DURATION };
