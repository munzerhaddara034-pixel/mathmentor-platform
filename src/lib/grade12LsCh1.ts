import type { ContentDraft, StoryboardScene } from "./types";

export const GRADE_12_LS_CH1_ID = "lesson-grade-12-ls-ch1";

export const grade12LsCh1Scenes: StoryboardScene[] = [
  {
    title: "Welcome · Chapter 1",
    narration:
      "Hello. I am Professor Munzer Haddara. Today we begin Grade 12 Life Sciences mathematics, Chapter 1: functions, with limits, continuity, and the derivative. Stay with the idea, then the notation, then one clean example.",
    board: "Chapter 1\nFunctions\nLimits · Continuity · Derivative",
    durationSeconds: 16,
  },
  {
    title: "What a limit means",
    narration:
      "A limit answers this question: what value does the function approach as x gets closer and closer to a number a? The function does not have to exist at a. We only care about the approach.",
    board: "As x → a, f(x) → L\nThe value at x = a may be missing.",
    durationSeconds: 18,
  },
  {
    title: "Notation on the board",
    narration:
      "We write: the limit as x approaches a of f of x equals L. Read it slowly. Limit. x approaches a. f of x. Equals L. If both sides agree, the two-sided limit exists.",
    board: "lim  f(x) = L\nx→a",
    durationSeconds: 18,
  },
  {
    title: "Worked example",
    narration:
      "Look at f of x equals x squared minus 4, over x minus 2. At x equals 2 the expression is 0 over 0, so it is not defined there. Factor the numerator: x minus 2 times x plus 2. Cancel x minus 2 for x not equal to 2. The simplified function is x plus 2. As x approaches 2, this approaches 4. So the limit is 4.",
    board: "lim (x² − 4)/(x − 2) = 4\nx→2\n\n(x−2)(x+2)/(x−2) = x+2  (x ≠ 2)",
    boardImage: "/boards/ls-ch1-limit.jpg",
    durationSeconds: 28,
  },
  {
    title: "Continuity in one sentence",
    narration:
      "A function is continuous at a if three things hold: f of a exists, the limit exists, and they are equal. Graphically, you can draw through a without lifting the pen.",
    board: "Continuous at a\n1) f(a) exists\n2) lim f(x) exists\n3) lim f(x) = f(a)",
    durationSeconds: 18,
  },
  {
    title: "Next: the derivative",
    narration:
      "The derivative is a special limit: the slope of the tangent. Next lesson we will compute that limit carefully. For now, remember: approach first, substitute only when it is safe. I will see you in the next part of Chapter 1.",
    board: "f'(a) = lim [f(a+h) − f(a)] / h\n         h→0",
    durationSeconds: 18,
  },
];

export function grade12LsCh1Draft(): ContentDraft {
  return {
    id: GRADE_12_LS_CH1_ID,
    libraryItemId: "grade-12-ls-book",
    kind: "lesson-video",
    title: "Grade 12 LS · Chapter 1 · Functions: Limits",
    skill: "Limits and continuity",
    questionRef: "grade-12/ls/chapter-1/limits",
    language: "en",
    videoScript: grade12LsCh1Scenes.map((scene, index) => `Scene ${index + 1} · ${scene.title}\n${scene.narration}\nBoard:\n${scene.board}`).join("\n\n"),
    storyboard: grade12LsCh1Scenes,
    printableSolution: `Grade 12 Life Sciences — Chapter 1 notes (Professor Munzer)

Topic: Limits of functions (opening of Chapter 1: Limits, Continuity, Derivative)

Key idea: the limit is the value approached, not necessarily the value attained.

Notation: lim x→a f(x) = L

Example: lim x→2 (x²−4)/(x−2) = 4, after cancelling (x−2) for x ≠ 2.

Continuity at a: f(a) exists, the limit exists, and they are equal.

Next: the derivative as a limit of slopes.

This sheet is an academy explanation aligned to the Ahlia Grade 12 LS chapter sequence. It is not a photocopy of the textbook.`,
    status: "approved",
    professorNote: "First chapter video requested by professor. Published for students after local review of the academy script.",
    reviewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}
