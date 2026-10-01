// Student-facing AI tutor persona: Professor Munzer, disclosed as an AI tutor, never "Dr. Mohamed".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { TUTOR_LABEL, TUTOR_NAME, TUTOR_PERSONA_AR, TUTOR_PERSONA_EN, TUTOR_VERIFIER_PERSONA_EN } from "../src/lib/tutor/persona.ts";

const STAFF_AGENT = /Mohamed|Mohammad|Muhammad|محمد|دكتور الرياضيات|Dr\.\s*M/;

test("persona names and AI labels in en/ar/fr", () => {
  assert.deepEqual(TUTOR_NAME, { en: "Professor Munzer", ar: "أستاذ منذر", fr: "Professeur Munzer" });
  assert.match(TUTOR_LABEL.en, /AI tutor/);
  assert.match(TUTOR_LABEL.ar, /الذكاء الاصطناعي/);
  assert.match(TUTOR_LABEL.fr, /tuteur IA/);
});

test("persona prompts disclose the AI, keep rigour, styles and English default", () => {
  for (const text of [TUTOR_PERSONA_EN, TUTOR_VERIFIER_PERSONA_EN]) {
    assert.doesNotMatch(text, STAFF_AGENT);
    assert.match(text, /not (?:Prof\. Munzer Haddara himself|the human teacher)/);
  }
  assert.match(TUTOR_PERSONA_EN, /never claim to be the human teacher/);
  for (const style of ["Lebanese official", "French Bac", "IB", "AP", "SAT/ACT", "IGCSE/A Level", "university"]) {
    assert.ok(TUTOR_PERSONA_EN.includes(style), style);
  }
  assert.match(TUTOR_PERSONA_EN, /doctor-level rigour/);
  assert.match(TUTOR_PERSONA_EN, /Write in English unless the student asks for Arabic or French/);
  assert.doesNotMatch(TUTOR_PERSONA_AR, STAFF_AGENT);
  assert.match(TUTOR_PERSONA_AR, /ولست الأستاذ منذر حداره نفسه/);
});

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

test("student-facing solver / tutor / chat prompts never use the staff agent persona", () => {
  const files = [
    ...filesUnder("src/lib/solver"),
    "src/lib/pedagogy/lebanese.ts",
    "src/lib/curriculum/tutor.ts",
    "src/app/api/solve-math/route.ts",
    "src/app/api/solve-math/gemini/route.ts",
    "src/app/api/bot/route.ts",
    "src/components/solver/SolverChat.tsx",
    "src/components/solver/SolverThread.tsx",
    "src/components/curriculum/PedagogicalTutorPanel.tsx",
    "src/components/ChatWidget.tsx",
  ];
  for (const file of files) assert.doesNotMatch(readFileSync(file, "utf8"), STAFF_AGENT, file);
  // Prompts may apply the teacher's method but must not impersonate him.
  assert.doesNotMatch(readFileSync("src/lib/pedagogy/lebanese.ts", "utf8"), /`You are \$\{INSTRUCTOR_EN\} \(/);
});
