// Curriculum / level detection and style-guide injection for the solver prompt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { curriculumStyleBlock, detectCurriculum, SOLVER_CURRICULA } from "../src/lib/solver/curriculum/index.ts";

test("explicit choice wins", () => {
  assert.equal(detectCurriculum({ question: "Solve x^2=4", selected: "ib" }).curriculum, "ib");
});

test("detects each major system from the statement", () => {
  const cases = [
    ["IB Mathematics: Analysis and Approaches HL, Paper 2", "ib"],
    ["AP Calculus AB free-response (calculator not allowed)", "ap"],
    ["SAT Math (multiple choice). If 3x + 2y = 12", "sat_act"],
    ["Cambridge International A Level Mathematics 9709, Paper 1", "cambridge"],
    ["Bac français, spécialité mathématiques. On considère la suite", "french_bac"],
    ["University linear algebra. Let A = [[4, 1], [2, 5]]", "university"],
  ];
  for (const [question, expected] of cases) assert.equal(detectCurriculum({ question, track: "gs" }).curriculum, expected, question);
});

test("track and platform fallbacks; level tiers", () => {
  const m = detectCurriculum({ question: "ABC est un triangle", track: "brevet" });
  assert.deepEqual([m.curriculum, m.level], ["lebanese", "middle"]);
  const s = detectCurriculum({ question: "f(x) = (x-1)e^x", track: "gs" });
  assert.deepEqual([s.curriculum, s.level], ["lebanese", "secondary"]);
  const u = detectCurriculum({ question: "Résoudre le problème de Cauchy y'' - 3y' + 2y = e^x", track: "gs" });
  assert.equal(u.level, "university");
  assert.equal(detectCurriculum({ question: "x+1=2", platform: "cambridge" }).curriculum, "cambridge");
  assert.equal(detectCurriculum({ question: "x+1=2" }).curriculum, "general");
  assert.equal(detectCurriculum({ question: "Prove that every continuous f is bounded" }).proof, true);
});

test("every curriculum has a style block", () => {
  for (const id of SOLVER_CURRICULA) assert.match(curriculumStyleBlock(id, "secondary"), /CURRICULUM STYLE/);
  assert.match(curriculumStyleBlock("ib", "secondary"), /command term/i);
  assert.match(curriculumStyleBlock("ap", "secondary"), /justification SENTENCE/);
});
