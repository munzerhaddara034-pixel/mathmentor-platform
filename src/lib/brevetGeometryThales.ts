import type { StoryboardScene } from "./types";
import type { NoteBlock } from "./lessonNotes";

export const BREVET_GEOMETRY_LESSON_ID = "grade-9-ch4";
export const BREVET_GEOMETRY_VIDEO_EN = "/videos/brevet-geometry-thales-en.mp4";
export const BREVET_GEOMETRY_VIDEO_FR = "/videos/brevet-geometry-thales-fr.mp4";

export const brevetGeometryNotesEn: NoteBlock[] = [
  { type: "h2", text: "Thales in a triangle — Brevet geometry" },
  {
    type: "p",
    text: "High-yield Brevet move: a line parallel to one side of a triangle cuts the other two sides in the same ratio. The trap is mixing the whole-side writing with the leftover-segment writing.",
  },
  { type: "h3", text: "The one idea" },
  {
    type: "p",
    text: "If (DE) is parallel to (BC), with D on [AB] and E on [AC], then the ratios on the two legs match, in the same form.",
  },
  { type: "math", tex: "\\frac{AD}{AB}=\\frac{AE}{AC}=\\frac{DE}{BC}" },
  {
    type: "example",
    title: "Worked example — whole-side writing",
    given: "(DE)//(BC), AD/AB=2/5, and AC=20 cm. Find AE.",
    tex: "\\frac{AE}{AC}=\\frac{2}{5}",
    steps: [
      "Copy the same form on AC: AE/AC=2/5.",
      "AE=(2/5)×20=8 cm.",
      "The leftover on AB is 3/5 of AB, which is a different sentence.",
    ],
    result: "AE = 8 cm",
  },
  {
    type: "example",
    title: "The other writing",
    given: "Same figure: AD/AB=2/5. What is AD/DB?",
    tex: "\\frac{AD}{DB}=\\frac{2}{3}",
    steps: [
      "DB/AB=1−2/5=3/5.",
      "AD/DB=(2/5)/(3/5)=2/3.",
      "Never copy 2/5 onto AD/DB.",
    ],
    result: "2/3, not 2/5",
  },
  {
    type: "mistake",
    title: "Mixing the two writings",
    wrong: "AD/AB=2/5, so AE/AC=3/5 or AD/DB=2/5.",
    right: "Stay in the writing of the question. Whole side with whole side; leftover with leftover. And do not quote Thales without the parallel.",
  },
  {
    type: "p",
    text: "Write the parallel first, copy the matching ratio, then check leftover versus whole side. Similar triangles is the same idea with equal angles.",
  },
];

export const brevetGeometryNotesFr: NoteBlock[] = [
  { type: "h2", text: "Thalès dans un triangle — Géométrie Brevet" },
  {
    type: "p",
    text: "Geste à haut rendement : une droite parallèle à un côté d'un triangle coupe les deux autres côtés dans le même rapport. Le piège est de mélanger l'écriture sur le côté entier et l'écriture sur le segment restant.",
  },
  { type: "h3", text: "L'idée unique" },
  {
    type: "p",
    text: "Si (DE) est parallèle à (BC), D sur [AB] et E sur [AC], alors les rapports sur les deux côtés coïncident, dans la même forme.",
  },
  { type: "math", tex: "\\frac{AD}{AB}=\\frac{AE}{AC}=\\frac{DE}{BC}" },
  {
    type: "example",
    title: "Exemple résolu — écriture du côté entier",
    given: "(DE)//(BC), AD/AB=2/5, et AC=20 cm. Trouver AE.",
    tex: "\\frac{AE}{AC}=\\frac{2}{5}",
    steps: [
      "On recopie la même forme sur AC : AE/AC=2/5.",
      "AE=(2/5)×20=8 cm.",
      "Le reste sur AB vaut 3/5 de AB : une autre phrase.",
    ],
    result: "AE = 8 cm",
  },
  {
    type: "example",
    title: "L'autre écriture",
    given: "Même figure : AD/AB=2/5. Que vaut AD/DB ?",
    tex: "\\frac{AD}{DB}=\\frac{2}{3}",
    steps: [
      "DB/AB=1−2/5=3/5.",
      "AD/DB=(2/5)/(3/5)=2/3.",
      "On ne recopie jamais 2/5 sur AD/DB.",
    ],
    result: "2/3, pas 2/5",
  },
  {
    type: "mistake",
    title: "Mélanger les deux écritures",
    wrong: "AD/AB=2/5, donc AE/AC=3/5 ou AD/DB=2/5.",
    right: "On reste dans l'écriture de la question. Côté entier avec côté entier ; reste avec reste. Et on n'invoque pas Thalès sans le parallèle.",
  },
  {
    type: "p",
    text: "Écrire d'abord le parallèle, recopier le rapport adapté, puis vérifier reste contre côté entier. Les triangles semblables sont la même idée avec les angles égaux.",
  },
];

export const brevetGeometryFallbackEn: StoryboardScene[] = [
  {
    title: "Not 3/5",
    narration: "DE parallel to BC and AD/AB=2/5. AE/AC is also 2/5, not the leftover 3/5.",
    board: "(DE)//(BC)\nAD/AB=2/5\nAE/AC=2/5, not 3/5",
    durationSeconds: 16,
  },
  {
    title: "One idea",
    narration: "A parallel to one side cuts the other two in the same ratio. Copy the same writing on both legs.",
    board: "AD/AB = AE/AC = DE/BC",
    durationSeconds: 14,
  },
  {
    title: "Worked example",
    narration: "If AC=20 cm, AE=8 cm. The leftover form AD/DB is 2/3, not 2/5.",
    board: "AE=8 cm\nAD/DB=2/3",
    durationSeconds: 18,
  },
  {
    title: "Trap",
    narration: "Do not mix whole side with leftover. Do not quote Thales without the parallel.",
    board: "Need // first\nAD/AB ≠ AD/DB",
    durationSeconds: 14,
  },
  {
    title: "Recap",
    narration: "Write the parallel, copy the same ratio in the same form, check the leftover.",
    board: "parallel · same form · check leftover",
    durationSeconds: 12,
  },
];

export const brevetGeometryFallbackFr: StoryboardScene[] = [
  {
    title: "Pas 3/5",
    narration: "DE parallèle à BC et AD/AB=2/5. AE/AC vaut aussi 2/5, pas le reste 3/5.",
    board: "(DE)//(BC)\nAD/AB=2/5\nAE/AC=2/5, pas 3/5",
    durationSeconds: 16,
  },
  {
    title: "Une idée",
    narration: "Une parallèle à un côté coupe les deux autres dans le même rapport. Même écriture sur les deux côtés.",
    board: "AD/AB = AE/AC = DE/BC",
    durationSeconds: 14,
  },
  {
    title: "Exemple résolu",
    narration: "Si AC=20 cm, AE=8 cm. L'écriture restante AD/DB vaut 2/3, pas 2/5.",
    board: "AE=8 cm\nAD/DB=2/3",
    durationSeconds: 18,
  },
  {
    title: "Piège",
    narration: "On ne mélange pas côté entier et reste. On n'invoque pas Thalès sans le parallèle.",
    board: "D'abord //\nAD/AB ≠ AD/DB",
    durationSeconds: 14,
  },
  {
    title: "Bilan",
    narration: "Écrire le parallèle, recopier le même rapport dans la même forme, vérifier le reste.",
    board: "parallèle · même forme · vérifier le reste",
    durationSeconds: 12,
  },
];
