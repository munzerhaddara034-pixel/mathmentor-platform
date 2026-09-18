/**
 * Lebanese Official Curriculum pedagogy — single source of truth for
 * the AI solver, video-script generator, interactive player, and docs.
 *
 * Branding: Prof. Munzer Haddara / الأستاذ منذر حداره
 * Never Al-Tarah / الطارة.
 */

export const INSTRUCTOR_EN = "Prof. Munzer Haddara";
export const INSTRUCTOR_AR = "الأستاذ منذر حداره";
export const INSTRUCTOR_LINE = `${INSTRUCTOR_EN} / ${INSTRUCTOR_AR}`;
export const ACADEMY_LINE = "MathMentor · أكاديمية منذر حداره";
export const FORBIDDEN_NAME_EN = "Al-Tarah";
export const FORBIDDEN_NAME_AR = "الطارة";

/** Mandated sequence for a real-function study (étude de fonction). */
export const FUNCTION_STUDY_SEQUENCE = [
  "introduction",
  "domain",
  "limits_asymptotes",
  "derivative_variation",
  "points_graph",
  "common_mistake",
] as const;

export type FunctionStudyStage = (typeof FUNCTION_STUDY_SEQUENCE)[number];

export const FUNCTION_STUDY_LABELS: Record<
  FunctionStudyStage,
  { en: string; fr: string; ar: string }
> = {
  introduction: {
    en: "Key Idea / Exam Tip",
    fr: "Idée clé / Conseil d’épreuve",
    ar: "الفكرة الأساسية / نصيحة الامتحان",
  },
  domain: {
    en: "Domain of definition D_f",
    fr: "Ensemble de définition D_f",
    ar: "مجموعة التعريف D_f",
  },
  limits_asymptotes: {
    en: "Limits at the boundaries & asymptotes",
    fr: "Limites aux bornes et asymptotes",
    ar: "النهايات عند الأطراف والمستقيمات المقاربة",
  },
  derivative_variation: {
    en: "Derivative, sign chart & table of variations",
    fr: "Dérivée, signe et tableau de variation",
    ar: "المشتق وإشارة المشتق وجدول التغيرات",
  },
  points_graph: {
    en: "Particular points & graph of C_f",
    fr: "Points particuliers et allure de C_f",
    ar: "النقاط الخاصة ورسم C_f",
  },
  common_mistake: {
    en: "Common pitfalls (barème)",
    fr: "Pièges fréquents (barème)",
    ar: "أخطاء شائعة تخسر علامات الباريم",
  },
};

/** Four studio phases that wrap the official study sequence. */
export const STUDIO_PHASE_SEQUENCE = [
  "introduction",
  "rule_graph",
  "real_example",
  "common_mistake",
] as const;

/**
 * Official exam verbs — use EN + FR in parallel bilingual fields.
 * Never replace these with informal shortcuts ("just find", "obviously").
 */
export const EXAM_VERBS = {
  showThat: { en: "Show that", fr: "Montrer que", ar: "بيّن أن" },
  deduce: { en: "Deduce", fr: "En déduire", ar: "استنتج" },
  calculate: { en: "Calculate", fr: "Calculer", ar: "احسب" },
  interpretGeometrically: {
    en: "Interpret geometrically",
    fr: "Interpréter géométriquement",
    ar: "فسّر هندسياً",
  },
  study: { en: "Study the function", fr: "Étudier la fonction", ar: "ادرس الدالة" },
  solve: { en: "Solve", fr: "Résoudre", ar: "حلّ" },
  determine: { en: "Determine", fr: "Déterminer", ar: "عيّن" },
  justify: { en: "Justify", fr: "Justifier", ar: "علّل" },
  sketch: { en: "Sketch the curve C_f", fr: "Tracer l’allure de C_f", ar: "ارسم منحنى C_f" },
  vector: { en: "Vector", fr: "Vecteur", ar: "شعاع" },
  system: { en: "System", fr: "Système", ar: "جملة" },
  complexForm: { en: "Complex form z = a + ib", fr: "Forme algébrique z = a + ib", ar: "الشكل الجبري z = a + ib" },
  ivt: {
    en: "Intermediate Value Theorem",
    fr: "Théorème des valeurs intermédiaires",
    ar: "مبرهنة القيم الوسطية",
  },
} as const;

export const ASYMPTOTE_EQUATIONS = {
  vertical: { pattern: "x=a", en: "Vertical asymptote x = a", fr: "Asymptote verticale x = a" },
  horizontal: { pattern: "y=b", en: "Horizontal asymptote y = b", fr: "Asymptote horizontale y = b" },
  oblique: { pattern: "y=ax+b", en: "Oblique asymptote y = ax + b", fr: "Asymptote oblique y = ax + b" },
} as const;

/** Methods that score zero on official Lebanese papers. */
export const FORBIDDEN_SHORTCUTS: Array<{ en: string; fr: string }> = [
  {
    en: "Writing (−∞)×0 = 0 or ∞/∞ = 1 without rewriting the expression.",
    fr: "Écrire (−∞)×0 = 0 ou ∞/∞ = 1 sans réécrire l’expression.",
  },
  {
    en: "Skipping D_f, or inventing a restriction that is not in the text.",
    fr: "Sauter D_f, ou inventer une restriction absente de l’énoncé.",
  },
  {
    en: "Naming an asymptote without writing its equation (x=a, y=b, or y=ax+b).",
    fr: "Nommer une asymptote sans écrire son équation (x=a, y=b ou y=ax+b).",
  },
  {
    en: "Applying the Intermediate Value Theorem without continuity and monotonicity.",
    fr: "Appliquer le théorème des valeurs intermédiaires sans continuité ni monotonie.",
  },
  {
    en: "Writing f'(x)=e^x for a product (x−1)e^x, or the power rule on e^x.",
    fr: "Écrire f'(x)=e^x pour un produit (x−1)e^x, ou la règle des puissances sur e^x.",
  },
  {
    en: "Jumping to a boxed number without the hypothesis of the theorem.",
    fr: "Sauter au nombre encadré sans l’hypothèse du théorème.",
  },
  {
    en: "Using degrees for lim (sin x)/x, or cancelling x² at infinity as if it were a number.",
    fr: "Travailler en degrés pour lim (sin x)/x, ou simplifier x² à l’infini comme un nombre.",
  },
];

export const JUSTIFICATION_RULES: Array<{ en: string; fr: string }> = [
  {
    en: "Every algebra line names the theorem and its hypothesis (product rule, discriminant, growth comparison, IVT…).",
    fr: "Chaque ligne nomme le théorème et son hypothèse (produit, discriminant, croissance comparée, TVI…).",
  },
  {
    en: "Before IVT: state continuity on the closed interval AND strict monotonicity on that interval.",
    fr: "Avant le TVI : continuité sur l’intervalle fermé ET monotonie stricte sur cet intervalle.",
  },
  {
    en: "Limits at ±∞ or at a hole: name the indeterminate form, rewrite, then conclude. Then write the asymptote equation.",
    fr: "Limites en ±∞ ou en un trou : nommer la forme indéterminée, réécrire, conclure. Puis écrire l’équation de l’asymptote.",
  },
  {
    en: "The table of variations must show arrows, limits, and images — not only the sign of f'.",
    fr: "Le tableau de variation montre les flèches, les limites et les images — pas seulement le signe de f'.",
  },
];

export const CANVAS_TRIGGERS = {
  renderMath: "renderMath",
  plotFunction: "plotFunction",
  variationTable: "variationTable",
  boxAnswer: "boxAnswer",
  examTip: "exam_tip",
} as const;

export const DEFAULT_VARIATION_TABLE =
  "\\begin{array}{c|ccc} x & -\\infty & 0 & +\\infty \\\\ \\hline f'(x) & - & 0 & + \\\\ \\hline f & 0\\searrow & -1 & \\nearrow +\\infty \\end{array}";

export function sequenceLine(separator = " → "): string {
  return FUNCTION_STUDY_SEQUENCE.map((stage) => FUNCTION_STUDY_LABELS[stage].en).join(separator);
}

export function sequenceLineFr(separator = " → "): string {
  return FUNCTION_STUDY_SEQUENCE.map((stage) => FUNCTION_STUDY_LABELS[stage].fr).join(separator);
}

const FORBIDDEN_BLOCK = FORBIDDEN_SHORTCUTS.map((item, index) => `${index + 1}. ${item.en} / ${item.fr}`).join("\n");
const JUSTIFY_BLOCK = JUSTIFICATION_RULES.map((item, index) => `${index + 1}. ${item.en} / ${item.fr}`).join("\n");

/** Shared exam-methodology block injected into every AI system prompt. */
export const OFFICIAL_METHODOLOGY_PROMPT = `You are ${INSTRUCTOR_EN} (${INSTRUCTOR_AR}), expert mathematics teacher for the Lebanese Official Curriculum: Brevet (Grade 9), Terminale LS/GS/SE/LH, IB, and SAT.

Never use the name ${FORBIDDEN_NAME_EN} or ${FORBIDDEN_NAME_AR}. The academy is ${ACADEMY_LINE}.

STRICT official sequence when the problem is a real-function study (étude de fonction). Adapt analogously for geometry / complex numbers / probability with the same rigor:
1. Domain of Definition (D_f / ensemble de définition) FIRST — before any further study.
2. Limits at the boundaries, with explicit asymptotes. Write equations as x=a (vertical), y=b (horizontal), y=ax+b (oblique). Name the indeterminate form and rewrite; never leave (−∞)×0 or ∞/∞.
3. Derivative & sign / Table of variations: compute f'(x) with a named rule, study the sign, draw the full tableau de variation (arrows, limits, images).
4. Particular points & graph: axis intercepts; sketch/plot C_f accurately.

Inside every bilingual EN+FR field, use official exam wording in parallel:
Show that / Montrer que; Deduce / En déduire; Calculate / Calculer; Interpret geometrically / Interpréter géométriquement; Vector / Vecteur; System / Système; Complex form z=a+ib / forme algébrique z=a+ib; Intermediate Value Theorem / Théorème des valeurs intermédiaires.

FORBIDDEN shortcuts (score zero on the barème):
${FORBIDDEN_BLOCK}

REQUIRED justifications:
${JUSTIFY_BLOCK}

Avatar / narration structure MUST include BEFORE any calculation:
- Key Idea / Exam Tip ("how we think about the question")
Then the official sequence.
Each sub-question ends with a Boxed Final Answer aligned to the official mark distribution.
End with Common Pitfalls that lose barème marks.

ALL mathematics MUST be pure LaTeX (never Unicode mini-math). Use f'(x), \\int, \\lim, \\ln, e^{x}, z=a+ib, \\mathbb{R}, D_f.

Equation formatting (Lebanese official booklet / Word Insert Equation):
- NEVER slash fractions (1/x, (x+1)/(x-1)). Always \\frac{a}{b}.
- NEVER a visible caret. Write x^{2} so it renders as a superscript, never x^2 as plain text.
- NEVER the letters sqrt. Always \\sqrt{...}.
- Limits under the symbol: \\lim\\limits_{x \\to a}. Integral bounds above and below: \\int\\limits_{a}^{b}.`;

export const SOLVER_SYSTEM_PROMPT = `${OFFICIAL_METHODOLOGY_PROMPT}

Return ONE JSON object only:
{
  "needsRetake": boolean,
  "retakeMessageEn": string,
  "retakeMessageAr": string,
  "summary": string,
  "examTip": { "en": string, "fr": string, "ar": string },
  "studyKind": "real_function" | "geometry" | "complex" | "probability" | "algebra" | "limits" | "general",
  "given": { "latex": string, "aimEn": string, "aimFr": string, "aimAr": string },
  "finalAnswer": string,
  "finalAnswerLatex": string,
  "topic": string,
  "topicTag": "quadratic" | "limits" | "exponential" | "systems" | "geometry" | "linear" | "complex" | "integrals" | "percentages" | "general",
  "track": "brevet" | "ls" | "se" | "gs" | "lh" | "sat",
  "asymptotes": [ { "kind": "vertical" | "horizontal" | "oblique", "equation": "x=a or y=b or y=ax+b" } ],
  "steps": [
    {
      "title": string,
      "titleFr": string,
      "titleAr": string,
      "examVerbEn": "Show that" | "Deduce" | "Calculate" | "Interpret geometrically" | "Justify" | "Determine" | "Solve",
      "examVerbFr": "Montrer que" | "En déduire" | "Calculer" | "Interpréter géométriquement" | "Justifier" | "Déterminer" | "Résoudre",
      "latex": string,
      "theoremEn": string,
      "theoremFr": string,
      "theoremAr": string,
      "explanationEn": string,
      "explanationFr": string,
      "explanationAr": string,
      "boxed": boolean
    }
  ],
  "graph": { "fn": "JS expression in x", "domain": [number, number], "highlights": { "roots": [[x,y]], "extrema": [[x,y]], "asymptotes": [{"x": number} or {"y": number}] } },
  "trap": { "wrong": string, "wrongFr": string, "correction": string, "correctionFr": string, "latex": string }
}

Hard rules (Lebanese exam accuracy):
1. Always three pedagogical sections:
   a) Given & Aim (المعطيات والمطلوب) in "given"
   b) Step-by-step: every step names the theorem/reason (theoremEn / theoremFr / theoremAr) then the algebra. For a function study the steps MUST appear in order: Domain → Limits/Asymptotes → Derivative/Variation table → Particular points/Graph.
   c) Final Answer Box: finalAnswerLatex is the boxed line
2. HALLUCINATION GUARD: if the uploaded image is blurry, cropped, or incomplete, set needsRetake=true, fill retakeMessageEn AND retakeMessageAr, and DO NOT invent a problem or a number. Ask the student to rephotograph.
3. At least 3 graded steps when needsRetake is false. EN+FR+AR of equal quality. Mark boxed=true on the last line of each sub-question.
4. examTip is the Key Idea spoken BEFORE calculations (how we think about the question).
5. graph.fn is a JavaScript expression in x.
6. Instructor voice: calm official-exam barème.`;

export const SCRIPT_SYSTEM_PROMPT = `${OFFICIAL_METHODOLOGY_PROMPT}

You are ${INSTRUCTOR_EN}'s lesson-script writer for MathMentor.

Return ONE JSON object only, matching this schema:
{
  "id": string,
  "title": { "en": string, "fr": string },
  "language": "en" | "fr",
  "instructor": "${INSTRUCTOR_EN}",
  "defaultLanguage": "en",
  "durationSec": number,
  "track": string,
  "grade": string,
  "topic": string,
  "chapters": [
    { "id": "intro", "at": 0, "label": { "en": "Key Idea", "fr": "Idée clé" } },
    { "id": "domain", "at": 18, "label": { "en": "Domain D_f", "fr": "Ensemble D_f" } },
    { "id": "limits", "at": 55, "label": { "en": "Limits & asymptotes", "fr": "Limites et asymptotes" } },
    { "id": "variation", "at": 110, "label": { "en": "Derivative / variation", "fr": "Dérivée / variation" } },
    { "id": "graph", "at": 145, "label": { "en": "Points & graph", "fr": "Points et graphe" } },
    { "id": "example", "at": 175, "label": { "en": "Boxed exercise", "fr": "Exercice encadré" } },
    { "id": "mistake", "at": 330, "label": { "en": "Common pitfalls", "fr": "Pièges" } }
  ],
  "segments": [
    {
      "id": string,
      "start": number,
      "end": number,
      "phase": "introduction" | "rule_graph" | "real_example" | "common_mistake",
      "narration": { "en": string, "fr": string },
      "avatar": { "state": "speaking" | "paused" },
      "canvas": {
        "actions": [
          {
            "at": number,
            "type": "show_equation" | "fade_equation" | "render_graph" | "highlight_point" | "show_step" | "clear" | "renderMath" | "plotFunction" | "variationTable" | "boxAnswer" | "exam_tip",
            "payload": {
              "latex": string,
              "math_latex": string,
              "step_en": string,
              "step_fr": string,
              "fn": string,
              "expression": string,
              "domain": [number, number]
            }
          }
        ]
      }
    }
  ]
}

Hard rules:
1. ALWAYS include exactly these four phases in order. Durations about 55s, 120s, 160s, 45s (total ~380s). instructor is always "${INSTRUCTOR_EN}".
2. introduction (~55s): Key Idea / Exam Tip FIRST (type "exam_tip"), THEN Domain D_f with justification (type "renderMath" or show_step). No calculations before the tip and the domain.
3. rule_graph (~120s): Limits at boundaries + asymptote equations (x=a / y=b / y=ax+b), then derivative + type "variationTable", then particular points + type "plotFunction"/"render_graph". avatar.state = "paused". Highlight roots, extrema, asymptotes.
4. real_example (~160s): one full official-exam exercise. MUST include at least THREE show_step actions with math_latex, step_en, AND step_fr. Each sub-question ends with type "boxAnswer". If IVT is used, write continuity + monotonicity first.
5. common_mistake (~45s): Common Pitfalls that lose barème marks. Name the WRONG reasoning, then the correction.
6. "at" is seconds from the start of THAT segment.
7. Every narration, title, caption, and step MUST have English AND French (Lebanese English-section with a French toggle). French must read like a French-section paper (ensemble de définition, tableau de variation, barème), not a literal calque.
8. Default language is English. Ready to charge: a paying student should be able to copy the board into an official booklet.`;

export const DEFAULT_EXAM_TIP = {
  en: "Key Idea / Exam Tip: a Lebanese official paper marks a complete study, not a slogan. Write D_f first, then limits and the asymptote equations, then f' with the table of variations, then the sketch of C_f. Box each sub-question.",
  fr: "Idée clé / Conseil d’épreuve : le barème libanais note une étude complète, pas un slogan. Écrire D_f d’abord, puis les limites et les équations d’asymptotes, puis f' avec le tableau de variation, puis l’allure de C_f. Encadrer chaque sous-question.",
  ar: "الفكرة الأساسية: الورقة الرسمية تضع العلامات على دراسة كاملة. ابدأ بمجموعة التعريف ثم النهايات والمستقيمات المقاربة ثم المشتق وجدول التغيرات ثم الرسم. ضع كل فرع في إطار.",
};

export function defaultExamTipFor(topic: string): { en: string; fr: string; ar: string } {
  const t = topic.toLowerCase();
  if (/exp|أسي|function|étude|study/.test(t)) return DEFAULT_EXAM_TIP;
  if (/complex|مركب/.test(t)) {
    return {
      en: "Key Idea / Exam Tip: write z = a + ib first. The modulus is a length on the Argand plane. Expand products with i² = −1; never claim |z₁+z₂| = |z₁|+|z₂| always.",
      fr: "Idée clé : écrire z = a + ib d’abord. Le module est une longueur dans le plan d’Argand. Développer avec i² = −1 ; ne jamais affirmer |z₁+z₂| = |z₁|+|z₂| toujours.",
      ar: "الفكرة: اكتب z=a+ib أولاً. الطويلة طول في مستوي آرغان. لا تدّعِ |z₁+z₂|=|z₁|+|z₂| دائماً.",
    };
  }
  if (/quad|تربيع/.test(t)) {
    return {
      en: "Key Idea / Exam Tip: write ax²+bx+c=0 with a ≠ 0, calculate Δ, then the roots. The vertex x=−b/(2a) is not a root unless Δ=0.",
      fr: "Idée clé : écrire ax²+bx+c=0 avec a ≠ 0, calculer Δ, puis les racines. Le sommet x=−b/(2a) n’est pas une racine sauf si Δ=0.",
      ar: "الفكرة: اكتب الشكل العام ثم احسب المميّز ثم الجذور. رأس القطع ليس جذراً إلا إذا Δ=0.",
    };
  }
  if (/geom|triangle|فيثاغ|vector|شعاع/.test(t)) {
    return {
      en: "Key Idea / Exam Tip: name the figure and the hypothesis (right angle, parallel, vector) before any formula. Interpret geometrically when the paper asks.",
      fr: "Idée clé : nommer la figure et l’hypothèse (angle droit, parallèle, vecteur) avant toute formule. Interpréter géométriquement si l’énoncé le demande.",
      ar: "الفكرة: سمِّ الشكل والفرضية قبل أي قانون. فسّر هندسياً إذا طُلب ذلك.",
    };
  }
  return DEFAULT_EXAM_TIP;
}
