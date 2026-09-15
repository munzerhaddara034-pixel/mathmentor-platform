import type { StoryboardScene } from "./types";
import type { NoteBlock } from "./lessonNotes";

export const GRADE_12_LS_DERIVATIVES_LESSON_ID = "grade-12-ch3";
export const GRADE_12_LS_DERIVATIVES_VIDEO_EN = "/videos/grade-12-ls-derivatives-en.mp4";
export const GRADE_12_LS_DERIVATIVES_VIDEO_FR = "/videos/grade-12-ls-derivatives-fr.mp4";

export const grade12LsDerivativesNotesEn: NoteBlock[] = [
  { type: "h2", text: "Derivative at a point — Grade 12 Life Sciences" },
  {
    type: "p",
    text: "Once continuity is in place, the derivative is a special limit: the limit of slopes. Average rate between 1 and 2 is not the instantaneous rate at 1.",
  },
  { type: "h3", text: "The one idea" },
  {
    type: "p",
    text: "f'(a) is the limit of the difference quotient as h goes to 0. If that two-sided limit exists, its value is the slope of the tangent at a.",
  },
  { type: "math", tex: "f'(a)=\\lim_{h\\to 0}\\frac{f(a+h)-f(a)}{h}" },
  {
    type: "example",
    title: "Worked example — x² at 2",
    given: "Compute f'(2) from the definition if f(x)=x².",
    tex: "\\frac{(2+h)^2-4}{h}",
    steps: [
      "Expand: (4+4h+h²−4)/h = 4+h for h≠0.",
      "Let h→0: the limit is 4, so f'(2)=4.",
      "Power-rule check: (x²)'=2x, and 2·2=4. Same number, two stories.",
    ],
    result: "f'(2) = 4",
  },
  {
    type: "mistake",
    title: "f'(a) = f(a)",
    wrong: "For x² at 2 the height is 4, so the derivative is 4 because the value is 4.",
    right: "Here slope and height happen to match. For 5x−4, f(0)=−4 while f'(x)=5. Height is not slope.",
  },
  {
    type: "mistake",
    title: "Continuous ⇒ differentiable",
    wrong: "|x| is continuous at 0, so it has a derivative there.",
    right: "Left difference quotient → −1, right → +1. No two-sided limit, so no f'(0).",
  },
  {
    type: "p",
    text: "Write the quotient, simplify for h≠0, then take the limit. Next: the sign of f' and the table of variations.",
  },
];

export const grade12LsDerivativesNotesFr: NoteBlock[] = [
  { type: "h2", text: "Nombre dérivé — Terminale Sciences de la vie" },
  {
    type: "p",
    text: "Une fois la continuité en place, la dérivée est une limite particulière : la limite des pentes. Le taux moyen entre 1 et 2 n'est pas le taux instantané en 1.",
  },
  { type: "h3", text: "L'idée unique" },
  {
    type: "p",
    text: "f'(a) est la limite du taux d'accroissement quand h tend vers 0. Si cette limite des deux côtés existe, sa valeur est la pente de la tangente en a.",
  },
  { type: "math", tex: "f'(a)=\\lim_{h\\to 0}\\frac{f(a+h)-f(a)}{h}" },
  {
    type: "example",
    title: "Exemple résolu — x² en 2",
    given: "Calculer f'(2) avec la définition si f(x)=x².",
    tex: "\\frac{(2+h)^2-4}{h}",
    steps: [
      "Développer : (4+4h+h²−4)/h = 4+h pour h≠0.",
      "h→0 : la limite vaut 4, donc f'(2)=4.",
      "Contrôle : (x²)'=2x et 2·2=4. Même nombre, deux récits.",
    ],
    result: "f'(2) = 4",
  },
  {
    type: "mistake",
    title: "f'(a) = f(a)",
    wrong: "Pour x² en 2 la hauteur vaut 4, donc la dérivée vaut 4 parce que l'image vaut 4.",
    right: "Ici pente et hauteur coïncident par accident. Pour 5x−4, f(0)=−4 tandis que f'(x)=5. La hauteur n'est pas la pente.",
  },
  {
    type: "mistake",
    title: "Continue ⇒ dérivable",
    wrong: "|x| est continue en 0, donc elle a une dérivée.",
    right: "Taux à gauche → −1, à droite → +1. Pas de limite des deux côtés, donc pas de f'(0).",
  },
  {
    type: "p",
    text: "Écrire le taux, simplifier pour h≠0, puis passer à la limite. Ensuite : signe de f' et tableau de variations.",
  },
];

export const grade12LsDerivativesFallbackEn: StoryboardScene[] = [
  {
    title: "Average is not instant",
    narration: "The slope between 1 and 2 is average rate. It is not f'(1). Instantaneous rate is a limit of slopes.",
    board: "[f(2)−f(1)]/(2−1)\nis not f'(1)",
    durationSeconds: 14,
  },
  {
    title: "Definition",
    narration: "f'(a) is the limit of [f(a+h)−f(a)]/h as h goes to 0. That number is the tangent slope.",
    board: "f'(a)=lim [f(a+h)−f(a)]/h\nh→0",
    durationSeconds: 16,
  },
  {
    title: "Worked example",
    narration: "For x squared at 2, the quotient becomes 4+h, then 4. Power rule 2x agrees.",
    board: "[(2+h)²−4]/h = 4+h\nf'(2)=4",
    durationSeconds: 18,
  },
  {
    title: "Trap",
    narration: "Height is not slope. |x| is continuous at 0 and has no derivative there.",
    board: "f'(a) ≠ f(a)\n|x|: no f'(0)",
    durationSeconds: 14,
  },
  {
    title: "Recap",
    narration: "Quotient, simplify, limit. Next: sign of f' and the table of variations.",
    board: "write · simplify · limit\nnext: sign of f'",
    durationSeconds: 12,
  },
];

export const grade12LsDerivativesFallbackFr: StoryboardScene[] = [
  {
    title: "Le moyen n'est pas l'instantané",
    narration: "La pente entre 1 et 2 est un taux moyen. Ce n'est pas f'(1). Le taux instantané est une limite de pentes.",
    board: "[f(2)−f(1)]/(2−1)\nn'est pas f'(1)",
    durationSeconds: 14,
  },
  {
    title: "Définition",
    narration: "f'(a) est la limite de [f(a+h)−f(a)]/h quand h tend vers 0. Ce nombre est la pente de la tangente.",
    board: "f'(a)=lim [f(a+h)−f(a)]/h\nh→0",
    durationSeconds: 16,
  },
  {
    title: "Exemple résolu",
    narration: "Pour x carré en 2, le taux devient 4+h, puis 4. La règle 2x le confirme.",
    board: "[(2+h)²−4]/h = 4+h\nf'(2)=4",
    durationSeconds: 18,
  },
  {
    title: "Piège",
    narration: "La hauteur n'est pas la pente. |x| est continue en 0 et n'a pas de dérivée.",
    board: "f'(a) ≠ f(a)\n|x| : pas de f'(0)",
    durationSeconds: 14,
  },
  {
    title: "Bilan",
    narration: "Taux, simplification, limite. Ensuite : signe de f' et tableau de variations.",
    board: "écrire · simplifier · limite\nensuite : signe de f'",
    durationSeconds: 12,
  },
];
