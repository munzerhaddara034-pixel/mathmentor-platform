// Curriculum / level detection and style-guide injection for the solver prompt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSolverPrompt } from "../src/lib/solver/prompt.ts";
import {
  curriculumStyleBlock,
  detectCurriculum,
  levelFromTrack,
  SOLVER_CURRICULA,
  trackForLevel,
} from "../src/lib/solver/curriculum/index.ts";

test("explicit choice wins over question keywords", () => {
  const d = detectCurriculum({ question: "IB Mathematics: Analysis and Approaches HL", selected: "lebanese", track: "gs" });
  assert.equal(d.curriculum, "lebanese");
  assert.equal(d.source, "selected");
  assert.equal(d.level, "secondary");
  assert.equal(d.ambiguous, false);
});

test("detects each major system from the statement when no form fields", () => {
  const cases = [
    ["IB Mathematics: Analysis and Approaches HL, Paper 2", "ib"],
    ["AP Calculus AB free-response (calculator not allowed)", "ap"],
    ["SAT Math (multiple choice). If 3x + 2y = 12", "sat_act"],
    ["Cambridge International A Level Mathematics 9709, Paper 1", "cambridge"],
    ["Bac français, spécialité mathématiques. On considère la suite", "french_bac"],
    ["University linear algebra. Let A = [[4, 1], [2, 5]]", "university"],
  ];
  for (const [question, expected] of cases) {
    const d = detectCurriculum({ question });
    assert.equal(d.curriculum, expected, question);
    assert.equal(d.ambiguous, false, question);
  }
});

test("site track is PRIMARY for level — text heuristics never override brevet / gs / university", () => {
  assert.equal(levelFromTrack("brevet"), "middle");
  const m = detectCurriculum({ question: "Find the eigenvalues of A (linear algebra)", track: "brevet" });
  assert.deepEqual([m.curriculum, m.level, m.ambiguous], ["lebanese", "middle", false]);

  const s = detectCurriculum({ question: "University real analysis: prove Bolzano–Weierstrass", track: "gs" });
  assert.equal(s.level, "secondary", "track=gs stays secondary even when the text says university");
  assert.equal(s.ambiguous, false);

  const u = detectCurriculum({ question: "ABC est un triangle rectangle", track: "university" });
  assert.equal(u.level, "university");
  assert.equal(u.ambiguous, false);
});

test("platform / selected curriculum are PRIMARY; WhatsApp level pick wins", () => {
  assert.equal(detectCurriculum({ question: "x+1=2", platform: "cambridge" }).curriculum, "cambridge");
  assert.equal(detectCurriculum({ question: "x+1=2", platform: "cambridge" }).ambiguous, false);
  const pick = detectCurriculum({ question: "x^2=4", level: "middle" });
  assert.equal(pick.level, "middle");
  assert.equal(pick.source, "level_pick");
  assert.equal(pick.ambiguous, false);
  assert.equal(trackForLevel("middle"), "brevet");
  assert.equal(trackForLevel("university"), "university");
});

test("ambiguous when nothing grounds the level (WhatsApp must ask, not guess secondary)", () => {
  const d = detectCurriculum({ question: "Solve x^2 - 5x + 6 = 0" });
  assert.equal(d.ambiguous, true);
  assert.equal(d.level, "secondary"); // placeholder only
  assert.equal(d.curriculum, "general");
});

test("middle vs secondary vs university prompt blocks stay separated", () => {
  const middle = buildSolverPrompt({
    question: "ABC est un triangle",
    language: "ar",
    decision: detectCurriculum({ question: "ABC", track: "brevet" }),
  });
  assert.match(middle, /LEVEL: middle school/);
  assert.match(middle, /never write secondary\/Bac|Forbidden in this answer: Terminale/i);
  assert.doesNotMatch(middle, /LEVEL: university/);
  assert.doesNotMatch(middle, /LEVEL: secondary \/ Bac ONLY/);

  const secondary = buildSolverPrompt({
    question: "f(x)=(x-1)e^x",
    language: "en",
    decision: detectCurriculum({ question: "f(x)", track: "gs" }),
  });
  assert.match(secondary, /LEVEL: secondary \/ Bac ONLY/);
  assert.match(secondary, /mark scheme|Barème/i);
  assert.doesNotMatch(secondary, /LEVEL: middle school/);
  assert.doesNotMatch(secondary, /LEVEL: university ONLY/);

  const university = buildSolverPrompt({
    question: "Prove every continuous f on [a,b] is bounded",
    language: "en",
    decision: detectCurriculum({ question: "Prove", track: "university" }),
  });
  assert.match(university, /LEVEL: university ONLY/);
  assert.match(university, /proof-level rigour|Full proof-level/i);
  assert.doesNotMatch(university, /LEVEL: middle school/);
  assert.doesNotMatch(university, /LEVEL: secondary \/ Bac ONLY/);

  const midStyle = curriculumStyleBlock("lebanese", "middle");
  assert.match(midStyle, /HARD SEPARATION/);
  assert.match(midStyle, /middle-school|Brevet/i);
  assert.doesNotMatch(midStyle, /Function study order: D_f/);
});

test("every curriculum has a style block", () => {
  for (const id of SOLVER_CURRICULA) assert.match(curriculumStyleBlock(id, "secondary"), /CURRICULUM STYLE/);
  assert.match(curriculumStyleBlock("ib", "secondary"), /command term/i);
  assert.match(curriculumStyleBlock("ap", "secondary"), /justification SENTENCE/);
});

test("proof flag still detected from the statement", () => {
  assert.equal(detectCurriculum({ question: "Prove that every continuous f is bounded", track: "gs" }).proof, true);
});
