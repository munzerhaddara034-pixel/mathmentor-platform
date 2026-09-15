import type { StoryboardScene } from "./types";
import type { NoteBlock } from "./lessonNotes";

export const GRADE_12_LS_CONTINUITY_LESSON_ID = "grade-12-ch2";
export const GRADE_12_LS_CONTINUITY_VIDEO_EN = "/videos/grade-12-ls-continuity-en.mp4";
export const GRADE_12_LS_CONTINUITY_VIDEO_FR = "/videos/grade-12-ls-continuity-fr.mp4";

export const grade12LsContinuityNotesEn: NoteBlock[] = [
  { type: "h2", text: "Continuity at a point — Grade 12 Life Sciences" },
  {
    type: "p",
    text: "After limits, the next official move is continuity. A graph may have a limit and still fail to be continuous. This note follows the classroom video: one idea, one worked example, the trap, then a short recap.",
  },
  { type: "h3", text: "The one idea" },
  {
    type: "p",
    text: "f is continuous at a when three facts hold together: f(a) is defined, the two-sided limit exists, and that limit equals f(a). Two out of three is not enough.",
  },
  { type: "math", tex: "f\\text{ continuous at }a \\iff f(a)\\text{ exists, }\\lim_{x\\to a}f(x)\\text{ exists, and they are equal.}" },
  {
    type: "example",
    title: "Worked example — piecewise jump",
    given: "f(x)=x+1 if x<1, f(1)=3, f(x)=2x if x>1. Is f continuous at 1?",
    tex: "f(x)=\\begin{cases}x+1&x<1\\\\3&x=1\\\\2x&x>1\\end{cases}",
    steps: [
      "Left: x+1 → 2. Right: 2x → 2. The two-sided limit is 2.",
      "f(1)=3, which is defined, but 3 ≠ 2.",
      "Condition 3 fails, so f is not continuous at 1.",
    ],
    result: "Not continuous at 1. The limit exists; the values do not match.",
  },
  {
    type: "example",
    title: "Worked example — glue with a parameter",
    given: "f(x)=x² if x<1, f(x)=k if x≥1. Find k so that f is continuous at 1.",
    tex: "f(x)=\\begin{cases}x^2&x<1\\\\k&x\\ge 1\\end{cases}",
    steps: [
      "Left limit: 1² = 1. Right limit and value: k.",
      "Continuity forces k = 1.",
      "Do not take k=2 from the derivative of x². That is the next lesson.",
    ],
    result: "k = 1",
  },
  {
    type: "mistake",
    title: "Limit exists ⇒ continuous",
    wrong: "Both sides approach 2, so the function is continuous at 1.",
    right: "You still need f(1) to equal that limit. A jump or a wrongly assigned value breaks continuity.",
  },
  {
    type: "mistake",
    title: "Defined ⇒ continuous",
    wrong: "f(a) is written, so f is continuous at a.",
    right: "Being defined is only the first ticket. The limit must exist and match.",
  },
  {
    type: "p",
    text: "Continuity is not differentiability. |x| is continuous at 0 and not differentiable there. Next video: the derivative as a limit of slopes.",
  },
];

export const grade12LsContinuityNotesFr: NoteBlock[] = [
  { type: "h2", text: "Continuité en un point — Terminale Sciences de la vie" },
  {
    type: "p",
    text: "Après les limites, le geste officiel suivant est la continuité. Un graphe peut avoir une limite sans être continu. Cette fiche suit la vidéo : une idée, un exemple résolu, le piège, un bilan.",
  },
  { type: "h3", text: "L'idée unique" },
  {
    type: "p",
    text: "f est continue en a lorsque trois faits tiennent ensemble : f(a) est définie, la limite des deux côtés existe, et cette limite vaut f(a). Deux sur trois ne suffisent pas.",
  },
  { type: "math", tex: "f\\text{ continue en }a \\iff f(a)\\text{ existe, }\\lim_{x\\to a}f(x)\\text{ existe, et elles sont égales.}" },
  {
    type: "example",
    title: "Exemple résolu — saut par morceaux",
    given: "f(x)=x+1 si x<1, f(1)=3, f(x)=2x si x>1. f est-elle continue en 1 ?",
    tex: "f(x)=\\begin{cases}x+1&x<1\\\\3&x=1\\\\2x&x>1\\end{cases}",
    steps: [
      "Gauche : x+1 → 2. Droite : 2x → 2. La limite des deux côtés vaut 2.",
      "f(1)=3 est définie, mais 3 ≠ 2.",
      "La troisième condition tombe : f n'est pas continue en 1.",
    ],
    result: "Pas continue en 1. La limite existe ; les valeurs ne coïncident pas.",
  },
  {
    type: "example",
    title: "Exemple résolu — coller avec un paramètre",
    given: "f(x)=x² si x<1, f(x)=k si x≥1. Trouver k pour que f soit continue en 1.",
    tex: "f(x)=\\begin{cases}x^2&x<1\\\\k&x\\ge 1\\end{cases}",
    steps: [
      "Limite à gauche : 1. Limite à droite et valeur : k.",
      "La continuité impose k = 1.",
      "On ne prend pas k=2, dérivée de x². C'est la leçon suivante.",
    ],
    result: "k = 1",
  },
  {
    type: "mistake",
    title: "Limite existante ⇒ continu",
    wrong: "Les deux côtés tendent vers 2, donc la fonction est continue en 1.",
    right: "Il faut encore que f(1) égale cette limite. Un saut ou une valeur mal collée casse la continuité.",
  },
  {
    type: "mistake",
    title: "Définie ⇒ continue",
    wrong: "f(a) est écrite, donc f est continue en a.",
    right: "Être définie n'est que le premier ticket. La limite doit exister et coïncider.",
  },
  {
    type: "p",
    text: "Continuité n'est pas dérivabilité. |x| est continue en 0 et non dérivable. Vidéo suivante : le nombre dérivé comme limite de pentes.",
  },
];

export const grade12LsContinuityFallbackEn: StoryboardScene[] = [
  {
    title: "The limit is not enough",
    narration:
      "Both sides approach 2, so the limit exists. Many students write continuous at 1. That sentence costs a mark. Continuity still needs the function value.",
    board: "x<1: x+1\nx=1: f(1)=3\nx>1: 2x\nlimit = 2, but f(1)=3",
    durationSeconds: 16,
  },
  {
    title: "Three conditions",
    narration: "Defined at a, two-sided limit exists, and they are equal. Miss one and it is not continuous there.",
    board: "1) f(a) exists\n2) lim exists\n3) lim = f(a)",
    durationSeconds: 16,
  },
  {
    title: "Worked example",
    narration: "Left 2, right 2, value 3. Not continuous. To glue x squared to a constant k at 1, take k=1.",
    board: "lim = 2 ≠ f(1)=3\nGlue: k = 1",
    durationSeconds: 18,
  },
  {
    title: "Trap",
    narration: "Limit exists does not mean continuous. Defined does not mean continuous. |x| is continuous at 0 and not differentiable.",
    board: "limit exists ≠ continuous\n|x| continuous at 0\nno derivative at 0",
    durationSeconds: 16,
  },
  {
    title: "Recap",
    narration: "Three checks. Next: the derivative, which is itself a limit of slopes.",
    board: "defined · limit · equal\nnext: f'(a)",
    durationSeconds: 12,
  },
];

export const grade12LsContinuityFallbackFr: StoryboardScene[] = [
  {
    title: "La limite ne suffit pas",
    narration:
      "Les deux côtés tendent vers 2, donc la limite existe. Beaucoup écrivent continue en 1. Il faut encore la valeur de la fonction.",
    board: "x<1: x+1\nx=1: f(1)=3\nx>1: 2x\nlimite = 2, mais f(1)=3",
    durationSeconds: 16,
  },
  {
    title: "Trois conditions",
    narration: "Définie en a, limite des deux côtés, et égalité. Il en manque une : pas continue.",
    board: "1) f(a) existe\n2) lim existe\n3) lim = f(a)",
    durationSeconds: 16,
  },
  {
    title: "Exemple résolu",
    narration: "Gauche 2, droite 2, valeur 3. Pas continue. Pour coller x carré à k en 1, k=1.",
    board: "lim = 2 ≠ f(1)=3\nColler : k = 1",
    durationSeconds: 18,
  },
  {
    title: "Piège",
    narration: "Limite existante ne veut pas dire continu. Définie ne veut pas dire continue. |x| est continue en 0, non dérivable.",
    board: "limite ≠ continu\n|x| continue en 0\npas de dérivée en 0",
    durationSeconds: 16,
  },
  {
    title: "Bilan",
    narration: "Trois contrôles. Ensuite : le nombre dérivé, limite de pentes.",
    board: "définie · limite · égales\nensuite : f'(a)",
    durationSeconds: 12,
  },
];
