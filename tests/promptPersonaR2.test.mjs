// Exam engine + team prompts: no "You are Prof. Munzer Haddara", brand «منذر حداره · MathMentor».
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("exam grader / generator prompts do not impersonate the human teacher", () => {
  for (const file of ["src/lib/exams/grader.ts", "src/lib/exams/generateSimilar.ts"]) {
    const source = read(file);
    assert.ok(!/You are Prof\.? Munzer/i.test(source), file);
    assert.ok(!/You are (?:Professor|Dr\.?) Munzer/i.test(source), file);
    assert.match(source, /MathMentor AI exam (?:grader|generator) \(brand: منذر حداره · MathMentor/, file);
  }
});

test("team prompts: brand «منذر حداره · MathMentor», Mohamed signs as «محمد», spec kept in sync", async () => {
  const { MOHAMED_SYSTEM_PROMPT_AR, SAMI_SYSTEM_PROMPT_AR, DEVELOPER_SYSTEM_PROMPT_AR } = await import("../src/lib/team/prompts.ts");
  for (const prompt of [MOHAMED_SYSTEM_PROMPT_AR, SAMI_SYSTEM_PROMPT_AR, DEVELOPER_SYSTEM_PROMPT_AR]) {
    assert.ok(!prompt.includes("منذر حداره / Munzer Haddara"));
    assert.ok(!prompt.includes("سكرتير الأستاذ منذر حداره"));
    assert.ok(prompt.includes("«منذر حداره · MathMentor»"));
  }
  assert.ok(MOHAMED_SYSTEM_PROMPT_AR.includes("محمد — منذر حداره · MathMentor"));
  const spec = read("docs/TEAM_CHAT_SPEC.md");
  assert.ok(!spec.includes("سكرتير الأستاذ منذر حداره"));
  assert.ok(!spec.includes("منذر حداره / Munzer Haddara"));
});
