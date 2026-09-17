export const pilotLesson = {
  id: "grade9-linear-equations-pilot",
  title: "Linear Equations: Find the Unknown",
  track: "Grade 9 Certificate",
  subject: "Mathematics",
  learningGoal: "Solve one-variable linear equations by undoing operations in the correct order and checking the result.",
  hook: "Think of an equation as a balanced scale: whatever you do to one side, do to the other.",
  steps: [
    "Circle the term containing the unknown.",
    "Undo addition or subtraction first.",
    "Undo multiplication or division next.",
    "Substitute the answer back to check both sides.",
  ],
  workedExample: {
    question: "3x + 5 = 20",
    solution: ["Subtract 5 from both sides: 3x = 15.", "Divide both sides by 3: x = 5.", "Check: 3(5) + 5 = 20, so the solution is correct."],
    answer: "x = 5",
  },
  challenge: [
    { question: "2x + 7 = 19", options: ["x = 5", "x = 6", "x = 13"], answer: "x = 6", explanation: "Subtract 7, then divide by 2." },
    { question: "5x - 4 = 21", options: ["x = 4", "x = 5", "x = 17"], answer: "x = 5", explanation: "Add 4, then divide by 5." },
    { question: "4(x + 2) = 24", options: ["x = 4", "x = 6", "x = 8"], answer: "x = 4", explanation: "Divide by 4 first, then subtract 2." },
  ],
  sourceNote: "Original academy explanation aligned to the Grade 9 algebra topic; do not reproduce textbook wording.",
} as const;
