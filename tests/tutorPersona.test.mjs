// Student-facing AI tutor persona: Youssef / يوسف, disclosed as an AI tutor, never the human teacher and never "Dr. Mohamed".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { TUTOR_LABEL, TUTOR_NAME, TUTOR_PERSONA_AR, TUTOR_PERSONA_EN, TUTOR_VERIFIER_PERSONA_EN } from "../src/lib/tutor/persona.ts";
import { en } from "../src/lib/i18n/messages/en.ts";
import { ar } from "../src/lib/i18n/messages/ar.ts";
import { fr } from "../src/lib/i18n/messages/fr.ts";

const STAFF_AGENT = /Mohamed|Mohammad|Muhammad|محمد|دكتور الرياضيات|Dr\.\s*M/;
/**
 * The retired AI persona. «الأستاذ منذر حداره» / «للأستاذ منذر» and "Prof. Munzer Haddara" name the HUMAN teacher and stay
 * allowed (preceded by «ل»); only the bare persona forms are banned in student-facing persona text.
 */
const OLD_PERSONA = /Professor Munzer|Professeur Munzer|(?:^|[^ل])أستاذ منذر/;

test("persona names and AI labels in en/ar/fr", () => {
  assert.deepEqual(TUTOR_NAME, { en: "Youssef", ar: "يوسف", fr: "Youssef" });
  assert.deepEqual(TUTOR_LABEL, { en: "Youssef · AI tutor", ar: "يوسف · معلّم بالذكاء الاصطناعي", fr: "Youssef · tuteur IA" });
  for (const value of [...Object.values(TUTOR_NAME), ...Object.values(TUTOR_LABEL)]) {
    assert.doesNotMatch(value, /Munzer|منذر/, value);
  }
});

test("persona prompts disclose the AI, keep rigour, styles and English default", () => {
  for (const text of [TUTOR_PERSONA_EN, TUTOR_VERIFIER_PERSONA_EN]) {
    assert.doesNotMatch(text, STAFF_AGENT);
    assert.doesNotMatch(text, OLD_PERSONA);
    assert.match(text, /You are (?:the independent verification pass of )?“Youssef”/);
    assert.match(text, /an AI, not the human teacher Munzer Haddara/);
  }
  assert.match(TUTOR_PERSONA_EN, /say plainly that you are Youssef, MathMentor's AI tutor/);
  assert.match(TUTOR_PERSONA_EN, /never claim to be the human teacher/);
  for (const style of ["Lebanese official", "French Bac", "IB", "AP", "SAT/ACT", "IGCSE/A Level", "university"]) {
    assert.ok(TUTOR_PERSONA_EN.includes(style), style);
  }
  assert.match(TUTOR_PERSONA_EN, /doctor-level rigour/);
  assert.match(TUTOR_PERSONA_EN, /Write in English unless the student asks for Arabic or French/);
  assert.doesNotMatch(TUTOR_PERSONA_AR, STAFF_AGENT);
  assert.doesNotMatch(TUTOR_PERSONA_AR, OLD_PERSONA);
  assert.match(TUTOR_PERSONA_AR, /^أنت «يوسف»، معلّم الرياضيات بالذكاء الاصطناعي/);
  assert.match(TUTOR_PERSONA_AR, /ولست المعلّم البشري منذر حداره نفسه/);
  assert.match(TUTOR_PERSONA_AR, /اكتب بالإنجليزية ما لم يطلب الطالب العربية أو الفرنسية/);
});

test("UI strings: Youssef with the AI-tutor label in en/ar/fr; old persona gone; human teacher kept", () => {
  const cases = [
    [en, "Youssef", "AI tutor", "Youssef · AI tutor", "Prof. Munzer Haddara"],
    [ar, "يوسف", "معلّم بالذكاء الاصطناعي", "يوسف · معلّم بالذكاء الاصطناعي", "الأستاذ منذر حداره"],
    [fr, "Youssef", "Tuteur IA", "Youssef · tuteur IA", "Prof. Munzer Haddara"],
  ];
  for (const [m, name, ai, label, teacher] of cases) {
    assert.equal(m.persona.name, name);
    assert.equal(m.persona.ai, ai);
    assert.equal(m.persona.label, label);
    assert.equal(m.persona.teacher, teacher);
    assert.equal(m.assistant.name, name);
    assert.ok(m.assistant.greeting.includes(name));
    assert.equal(m.solver.title, name);
    assert.ok(m.solver.aiNote.includes(name) && m.solver.aiNote.includes(teacher));
    for (const text of [m.tutor.ready, m.tutor.thinking, m.home.askSubmit, m.home.demoLead, m.result.read, m.result.reviewBody]) {
      assert.ok(text.includes(name), text);
    }
    // The real teacher's live 1:1 sessions keep his name.
    assert.ok(m.dashboard.nextWith.includes(teacher), m.dashboard.nextWith);
    assert.doesNotMatch(JSON.stringify(m), OLD_PERSONA);
  }
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
  const personaFiles = [
    ...files,
    "src/lib/tutor/persona.ts",
    "src/app/page.tsx",
    "src/app/math-solver/page.tsx",
    ...filesUnder("src/components/v2"),
    ...filesUnder("src/components/home/v2"),
    "src/components/dashboard/OrbNudge.tsx",
  ];
  for (const file of personaFiles) assert.doesNotMatch(readFileSync(file, "utf8"), OLD_PERSONA, file);
  // The classroom tutor reply names itself Youssef; its "Professor Munzer reviews …" line is the human teacher.
  assert.match(readFileSync("src/app/api/tutor/route.ts", "utf8"), /I am Youssef, the AI classroom tutor\./);
  // Prompts may apply the teacher's method but must not impersonate him.
  assert.doesNotMatch(readFileSync("src/lib/pedagogy/lebanese.ts", "utf8"), /`You are \$\{INSTRUCTOR_EN\} \(/);
});
