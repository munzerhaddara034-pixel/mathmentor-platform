// Student-facing AI tutor: «الدكتور محمد · مساعد منذر» / "Dr. Mohamed · Munzer's assistant", disclosed as an AI tutor, never the human teacher.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { TUTOR_LABEL, TUTOR_NAME, TUTOR_PERSONA_AR, TUTOR_PERSONA_EN, TUTOR_VERIFIER_PERSONA_EN } from "../src/lib/tutor/persona.ts";
import { en } from "../src/lib/i18n/messages/en.ts";
import { ar } from "../src/lib/i18n/messages/ar.ts";
import { fr } from "../src/lib/i18n/messages/fr.ts";

/** Retired site-tutor names (must not remain as the student-facing display persona). */
const OLD_SITE_TUTOR = /\bYoussef\b|يوسف|Professor Munzer|Professeur Munzer|(?:^|[^ل])أستاذ منذر/;
/** Staff-only secretary phrasing must not leak into student solver prompts. */
const STAFF_SECRETARY = /سكرتير التنفيذي|Agent Hub|دكتور الرياضيات لكل المستويات/;

test("persona names and AI labels use the full Dr. Mohamed · Munzer's assistant presentation", () => {
  assert.deepEqual(TUTOR_NAME, {
    en: "Dr. Mohamed · Munzer's assistant",
    ar: "الدكتور محمد · مساعد منذر",
    fr: "Dr Mohamed · assistant de Munzer",
  });
  assert.deepEqual(TUTOR_LABEL, {
    en: "Dr. Mohamed · Munzer's assistant · AI tutor",
    ar: "الدكتور محمد · مساعد منذر · معلّم بالذكاء الاصطناعي",
    fr: "Dr Mohamed · assistant de Munzer · tuteur IA",
  });
  for (const value of [...Object.values(TUTOR_NAME), ...Object.values(TUTOR_LABEL)]) {
    assert.doesNotMatch(value, /\bYoussef\b|يوسف/);
    assert.match(value, /Mohamed|محمد/);
    assert.match(value, /Munzer|منذر/);
  }
});

test("persona prompts disclose the AI, keep rigour, styles and English default", () => {
  for (const text of [TUTOR_PERSONA_EN, TUTOR_VERIFIER_PERSONA_EN]) {
    assert.doesNotMatch(text, OLD_SITE_TUTOR);
    assert.doesNotMatch(text, STAFF_SECRETARY);
    assert.match(text, /Dr\. Mohamed · Munzer's assistant/);
    assert.match(text, /an AI, not the human teacher Munzer Haddara/);
  }
  assert.match(TUTOR_PERSONA_EN, /say plainly that you are Dr\. Mohamed · Munzer's assistant, MathMentor's AI tutor/);
  assert.match(TUTOR_PERSONA_EN, /never claim to be the human teacher/);
  for (const style of ["Lebanese official", "French Bac", "IB", "AP", "SAT/ACT", "IGCSE/A Level", "university"]) {
    assert.ok(TUTOR_PERSONA_EN.includes(style), style);
  }
  assert.match(TUTOR_PERSONA_EN, /doctor-level rigour/);
  assert.match(TUTOR_PERSONA_EN, /Write in English unless the student asks for Arabic or French/);
  assert.doesNotMatch(TUTOR_PERSONA_AR, OLD_SITE_TUTOR);
  assert.match(TUTOR_PERSONA_AR, /^أنت «الدكتور محمد · مساعد منذر»، معلّم الرياضيات بالذكاء الاصطناعي/);
  assert.match(TUTOR_PERSONA_AR, /ولست المعلّم البشري منذر حداره نفسه/);
  assert.match(TUTOR_PERSONA_AR, /اكتب بالإنجليزية ما لم يطلب الطالب العربية أو الفرنسية/);
});

test("UI strings: full Dr. Mohamed presentation + AI-tutor label in en/ar/fr; human teacher kept", () => {
  const cases = [
    [en, "Dr. Mohamed · Munzer's assistant", "AI tutor", "Dr. Mohamed · Munzer's assistant · AI tutor", "Prof. Munzer Haddara"],
    [ar, "الدكتور محمد · مساعد منذر", "معلّم بالذكاء الاصطناعي", "الدكتور محمد · مساعد منذر · معلّم بالذكاء الاصطناعي", "الأستاذ منذر حداره"],
    [fr, "Dr Mohamed · assistant de Munzer", "Tuteur IA", "Dr Mohamed · assistant de Munzer · tuteur IA", "Prof. Munzer Haddara"],
  ];
  for (const [m, name, ai, label, teacher] of cases) {
    assert.equal(m.persona.name, name);
    assert.equal(m.persona.ai, ai);
    assert.equal(m.persona.label, label);
    assert.equal(m.persona.teacher, teacher);
    assert.ok(m.persona.role, "persona.role required for SolverHeader");
    assert.ok(m.persona.label.includes(m.persona.role));
    assert.equal(m.assistant.name, name);
    assert.ok(m.assistant.greeting.includes(name.split(" · ")[0]) || m.assistant.greeting.includes(name));
    assert.equal(m.solver.title, name);
    assert.ok(m.solver.aiNote.includes(name.split(" · ")[0]) || m.solver.aiNote.includes("Munzer") || m.solver.aiNote.includes("منذر"));
    for (const text of [m.tutor.ready, m.tutor.thinking, m.home.askSubmit, m.home.demoLead, m.result.read, m.result.reviewBody]) {
      assert.ok(text.includes(name) || text.includes(name.split(" · ")[0]), text);
    }
    assert.ok(m.dashboard.nextWith.includes(teacher), m.dashboard.nextWith);
    assert.doesNotMatch(JSON.stringify(m), /\bYoussef\b|يوسف/);
  }
});

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

test("student-facing solver / tutor / chat prompts never use the retired Youssef persona or staff-secretary phrasing", () => {
  const files = [
    ...filesUnder("src/lib/solver").filter((f) => !f.includes("/pdf/")),
    ...filesUnder("src/lib/tutor"),
    "src/lib/curriculum/tutor.ts",
    "src/app/api/bot/route.ts",
    "src/app/api/tutor/route.ts",
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\bYoussef\b|يوسف/, file);
    assert.doesNotMatch(text, STAFF_SECRETARY, file);
  }
  const personaFiles = [
    ...files,
    "src/lib/tutor/persona.ts",
    "src/app/page.tsx",
    "src/app/math-solver/page.tsx",
    ...filesUnder("src/components/v2"),
    ...filesUnder("src/components/home/v2"),
    "src/components/dashboard/OrbNudge.tsx",
  ];
  // Human-teacher references ("Professor Munzer reviews…") stay allowed; bare AI-impersonation forms stay banned.
  for (const file of personaFiles) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /You are (?:Professor|Professeur) Munzer|أنت «?أستاذ منذر/, file);
  }
  assert.match(readFileSync("src/app/api/tutor/route.ts", "utf8"), /I am Dr\. Mohamed · Munzer's assistant, the AI classroom tutor\./);
  assert.doesNotMatch(readFileSync("src/lib/pedagogy/lebanese.ts", "utf8"), /`You are \$\{INSTRUCTOR_EN\} \(/);
});
