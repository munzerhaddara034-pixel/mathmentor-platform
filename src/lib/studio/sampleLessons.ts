import { L } from "./i18n";
import { officialExamFourPhaseLesson, officialExamSceneTimeline } from "./seedLesson";
import type { LessonTimeline } from "./timeline";

export const exponentialFunctionsLesson: LessonTimeline = officialExamFourPhaseLesson;

export const complexNumbersLesson: LessonTimeline = {
  id: "ls-complex-numbers",
  topic: "Complex Numbers",
  track: "ls",
  grade: "Grade 12 · LS / GS",
  defaultLanguage: "en",
  title: L("Complex Numbers — the Argand plane", "Nombres complexes — le plan d’Argand"),
  language: "en",
  durationSec: 240,
  instructor: "Prof. Munzer Haddara",
  media: { poster: "/teachers/munzer.jpg" },
  segments: [
    {
      id: "intro",
      start: 0,
      end: 30,
      phase: "introduction",
      avatar: { state: "speaking" },
      narration: L(
        "Complex numbers in the Lebanese Baccalaureate — especially LS and GS. Each z = a + bi is a point in the plane. The modulus is the distance from the origin.",
        "Les nombres complexes au baccalauréat libanais — surtout LS et GS. Chaque z = a + bi est un point du plan. Le module est la distance à l’origine.",
      ),
      canvas: {
        actions: [
          {
            at: 3,
            type: "show_equation",
            payload: {
              latex: "z=a+bi,\\quad i^{2}=-1",
              math_latex: "z=a+bi,\\quad i^{2}=-1",
              caption: L("Concept definition", "Définition"),
            },
          },
          {
            at: 14,
            type: "show_step",
            payload: {
              latex: "|z|=\\sqrt{a^{2}+b^{2}}",
              math_latex: "|z|=\\sqrt{a^{2}+b^{2}}",
              step_en: "The modulus is the length of the vector from the origin.",
              step_fr: "Le module est la longueur du vecteur depuis l’origine.",
              text: L(
                "The modulus is the length of the vector from the origin.",
                "Le module est la longueur du vecteur depuis l’origine.",
              ),
            },
          },
        ],
      },
    },
    {
      id: "rule-graph",
      start: 30,
      end: 90,
      phase: "rule_graph",
      avatar: { state: "paused" },
      narration: L(
        "I freeze on the drawing. z = 3 − 4i sits in quadrant IV. The modulus is 5. The roots of z² + 1 = 0 are ±i.",
        "Je gèle le dessin. z = 3 − 4i est dans le quadrant IV. Le module vaut 5. Les racines de z² + 1 = 0 sont ±i.",
      ),
      canvas: {
        actions: [
          {
            at: 0,
            type: "show_equation",
            payload: {
              latex: "|3-4i|=5",
              caption: L("Rule on the Argand plane", "Règle dans le plan d’Argand"),
            },
          },
          {
            at: 8,
            type: "render_graph",
            payload: {
              kind: "argand",
              xDomain: [-5, 5],
              yDomain: [-5, 5],
              title: L("Argand plane", "Plan d’Argand"),
              points: [
                { x: 3, y: -4, kind: "point", label: L("3 − 4i", "3 − 4i") },
                { x: 0, y: 1, kind: "root", label: L("i", "i") },
                { x: 0, y: -1, kind: "root", label: L("−i", "−i") },
              ],
            },
          },
          {
            at: 22,
            type: "highlight_point",
            payload: { kind: "point", x: 3, y: -4, label: L("z = 3 − 4i", "z = 3 − 4i") },
          },
        ],
      },
    },
    {
      id: "real-example",
      start: 90,
      end: 210,
      phase: "real_example",
      avatar: { state: "speaking" },
      narration: L(
        "Multiplication example: (2 + i)(3 − i). Expand, replace i² by −1, collect parts, then check with the modulus.",
        "Exemple de produit : (2 + i)(3 − i). Développez, remplacez i² par −1, rassemblez, puis vérifiez avec le module.",
      ),
      canvas: {
        actions: [
          { at: 0, type: "clear", payload: {} },
          {
            at: 4,
            type: "show_equation",
            payload: { latex: "(2+i)(3-i)", math_latex: "(2+i)(3-i)", caption: L("Given", "Donnée") },
          },
          {
            at: 16,
            type: "show_step",
            payload: {
              latex: "6-2i+3i-i^{2}",
              math_latex: "6-2i+3i-i^{2}",
              step_en: "Step 1 — distribute.",
              step_fr: "Étape 1 — distribuer.",
              text: L("Step 1 — distribute.", "Étape 1 — distribuer."),
            },
          },
          {
            at: 40,
            type: "show_step",
            payload: {
              latex: "i^{2}=-1 \\Rightarrow -i^{2}=+1",
              math_latex: "i^{2}=-1 \\Rightarrow -i^{2}=+1",
              step_en: "Step 2 — replace i².",
              step_fr: "Étape 2 — remplacer i².",
              text: L("Step 2 — replace i².", "Étape 2 — remplacer i²."),
            },
          },
          {
            at: 64,
            type: "show_step",
            payload: {
              latex: "6+1+(-2i+3i)=7+i",
              math_latex: "6+1+(-2i+3i)=7+i",
              step_en: "Step 3 — collect terms.",
              step_fr: "Étape 3 — rassembler les termes.",
              text: L("Step 3 — collect terms.", "Étape 3 — rassembler les termes."),
            },
          },
        ],
      },
    },
    {
      id: "common-mistake",
      start: 210,
      end: 240,
      phase: "common_mistake",
      avatar: { state: "speaking" },
      narration: L(
        "The official trap: claiming |z1 + z2| = |z1| + |z2| always. Write the triangle inequality instead.",
        "Le piège officiel : affirmer |z1 + z2| = |z1| + |z2| toujours. Écrivez plutôt l’inégalité triangulaire.",
      ),
      canvas: {
        actions: [
          {
            at: 3,
            type: "show_equation",
            payload: {
              latex: "|z_1+z_2|\\le |z_1|+|z_2|",
              caption: L("The correct inequality", "La bonne inégalité"),
            },
          },
        ],
      },
    },
  ],
};

export const sampleLessons = {
  exponential: exponentialFunctionsLesson,
  complex: complexNumbersLesson,
  "leb-term-func-01": officialExamSceneTimeline,
};

export function getSampleLesson(id: string | null | undefined) {
  if (!id) return exponentialFunctionsLesson;
  const key = id.toLowerCase();
  if (key.includes("complex") || key.includes("مركب")) return complexNumbersLesson;
  if (key.includes("leb-term") || key === "scenes") return officialExamSceneTimeline;
  return exponentialFunctionsLesson;
}
