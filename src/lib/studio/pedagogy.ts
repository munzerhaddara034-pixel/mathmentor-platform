import { L } from "./i18n";
import {
  REQUIRED_PHASES,
  hasGradedExample,
  hasRenderGraph,
  hasStepByStep,
  type CanvasAction,
  type LessonPhase,
  type LessonSegment,
  type LessonTimeline,
  type LessonLanguage,
} from "./timeline";

const PHASE_DURATION: Record<LessonPhase, number> = {
  introduction: 50,
  rule_graph: 100,
  real_example: 160,
  common_mistake: 40,
};

function bilingual(en: string, fr: string) {
  return L(en, fr);
}

function shiftActions(actions: CanvasAction[], extra = 0): CanvasAction[] {
  return actions.map((action) => ({ ...action, at: action.at + extra }));
}

export function ensurePedagogy(timeline: LessonTimeline): LessonTimeline {
  const byPhase = new Map<LessonPhase, LessonSegment>();
  for (const segment of timeline.segments) {
    if (!byPhase.has(segment.phase)) byPhase.set(segment.phase, segment);
  }

  let cursor = 0;
  const segments: LessonSegment[] = REQUIRED_PHASES.map((phase) => {
    const existing = byPhase.get(phase);
    const duration = existing ? Math.max(8, existing.end - existing.start) : PHASE_DURATION[phase];
    const start = cursor;
    const end = cursor + duration;
    cursor = end;

    if (existing) {
      return {
        ...existing,
        start,
        end,
        avatar: {
          state: phase === "rule_graph" ? "paused" : existing.avatar.state,
        },
        canvas: {
          actions: existing.canvas.actions.map((action) => ({
            ...action,
            at: Math.min(action.at, Math.max(0, duration - 1)),
          })),
        },
      };
    }

    return placeholderSegment(phase, start, end, timeline.language, timeline.title.en);
  });

  const next: LessonTimeline = {
    ...timeline,
    durationSec: cursor,
    segments,
  };

  const rule = next.segments.find((segment) => segment.phase === "rule_graph")!;
  if (!hasRenderGraph(next)) {
    rule.canvas.actions.push({
      at: Math.min(8, Math.max(1, rule.end - rule.start - 2)),
      type: "render_graph",
      payload: {
        kind: "function",
        fn: "exp(x)",
        xDomain: [-2, 2],
        yDomain: [-1, 8],
        title: bilingual("Mandatory graph", "Graphe obligatoire"),
      },
    });
  }

  const example = next.segments.find((segment) => segment.phase === "real_example")!;
  const existingSteps = example.canvas.actions.filter((action) => action.type === "show_step").length;
  if (existingSteps < 3) {
    const fillers: CanvasAction[] = [
      {
        at: 8,
        type: "show_step",
        payload: {
          latex: "\\text{Given }\\to\\text{ hypothesis }\\to\\text{ rule}",
          math_latex: "\\text{Given }\\to\\text{ hypothesis }\\to\\text{ rule}",
          step_en: "Step 1 — copy the given and the domain or hypothesis from the paper.",
          step_fr: "Étape 1 — recopier les données et l’hypothèse (ou le domaine) de l’énoncé.",
          text: bilingual(
            "Step 1 — copy the given and the domain or hypothesis from the paper.",
            "Étape 1 — recopier les données et l’hypothèse (ou le domaine) de l’énoncé.",
          ),
        },
      },
      {
        at: 36,
        type: "show_step",
        payload: {
          latex: "\\text{algebra: expand / factor / substitute}",
          math_latex: "\\text{algebra: expand / factor / substitute}",
          step_en: "Step 2 — every algebra line (expand, factor, substitute). No skipped equals.",
          step_fr: "Étape 2 — chaque ligne d’algèbre (développer, factoriser, substituer). Aucune égalité sautée.",
          text: bilingual(
            "Step 2 — every algebra line (expand, factor, substitute). No skipped equals.",
            "Étape 2 — chaque ligne d’algèbre (développer, factoriser, substituer). Aucune égalité sautée.",
          ),
        },
      },
      {
        at: 70,
        type: "show_step",
        payload: {
          latex: "\\text{check by substitution, then box}",
          math_latex: "\\text{check by substitution, then box}",
          step_en: "Step 3 — substitute back and box the conclusion the marker wants.",
          step_fr: "Étape 3 — substituer et encadrer la conclusion attendue par le barème.",
          text: bilingual(
            "Step 3 — substitute back and box the conclusion the marker wants.",
            "Étape 3 — substituer et encadrer la conclusion attendue par le barème.",
          ),
        },
      },
    ];
    for (const extra of fillers.slice(existingSteps)) {
      example.canvas.actions.push(extra);
    }
  }

  if (!hasRenderGraph(next) || !hasStepByStep(next) || !hasGradedExample(next)) {
    throw new Error("Pedagogy repair failed: missing graph, or fewer than 3 graded example steps.");
  }

  return next;
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
        `We define ${topic} as it appears in Lebanese official exams (Brevet / Terminale LS, GS, SE).`,
        `Nous définissons ${topic} tel qu’il apparaît dans les examens officiels libanais (Brevet / Terminale LS, GS, SE).`,
      ),
      canvas: {
        actions: [
          {
            at: 2,
            type: "show_equation",
            payload: {
              latex: "\\text{" + topic.replace(/[\\{}]/g, "") + "}",
              caption: bilingual("Concept definition", "Définition"),
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
        "We freeze at the board to draw the rule and mark roots, asymptotes, and extrema when they exist.",
        "Nous gelons l’avatar pour tracer la règle et marquer racines, asymptotes et extrema s’ils existent.",
      ),
      canvas: {
        actions: [
          {
            at: 4,
            type: "render_graph",
            payload: {
              kind: "function",
              fn: "exp(x)",
              xDomain: [-2, 2],
              yDomain: [-1, 8],
              title: bilingual("Mandatory graph", "Graphe obligatoire"),
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
        `A full worked example on ${topic} with substitution and a check.`,
        `Un exemple entièrement résolu sur ${topic} avec substitution et vérification.`,
      ),
      canvas: {
        actions: [
          {
            at: 4,
            type: "show_step",
            payload: {
              latex: "\\text{Step 1 — given and hypothesis}",
              text: bilingual("Copy the given and the hypothesis.", "Recopiez les données et l’hypothèse."),
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
            type: "show_step",
            payload: {
              latex: "\\text{Step 3 — check and box}",
              text: bilingual("Substitute back, then box the conclusion.", "Substituez, puis encadrez la conclusion."),
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
      "A warning about the typical official-exam mistake.",
      "Un avertissement sur l’erreur typique des examens officiels.",
    ),
    canvas: {
      actions: [
        {
          at: 3,
          type: "show_equation",
          payload: {
            latex: "\\text{Check the hypothesis before the formula.}",
            caption: bilingual("Common mistake", "Erreur fréquente"),
          },
        },
      ],
    },
  };
}

export { shiftActions, PHASE_DURATION };
