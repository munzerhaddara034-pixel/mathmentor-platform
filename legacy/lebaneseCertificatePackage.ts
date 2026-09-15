export type WorkedProblem = {
  prompt: string;
  steps: string[];
  answer: string;
};

export type CertificatePracticeQuestion = WorkedProblem & {
  options: string[];
};

export const lebaneseBrevetMathPackage = {
  id: "lebanese-brevet-mathematics-foundations",
  title: "Lebanese Brevet Mathematics · Algebra Foundations",
  arabicTitle: "رياضيات الشهادة المتوسطة اللبنانية · أساسيات الجبر",
  grade: "9",
  branch: "Brevet / Intermediate Certificate",
  source: "CRDP Lebanese Curriculum Digital Library · Mathematics · Grade 9",
  sourceUrl: "https://mawaridy.crdp.org/Library/index/1",
  reviewStatus: "Professor review required",
  lessons: [
    {
      id: "brevet-algebra-linear-equations",
      title: "Linear equations and the balance rule",
      arabicTitle: "المعادلات الخطية وقاعدة التوازن",
      objective: "Solve a one-variable equation and verify the result.",
      worked: {
        prompt: "3x + 5 = 20",
        steps: ["Subtract 5 from both sides: 3x = 15.", "Divide both sides by 3: x = 5.", "Check: 3(5) + 5 = 20."],
        answer: "x = 5",
      },
      practice: [
        { prompt: "2x + 7 = 19", options: ["x = 5", "x = 6", "x = 13"], steps: ["Subtract 7: 2x = 12.", "Divide by 2: x = 6."], answer: "x = 6" },
        { prompt: "5x - 4 = 21", options: ["x = 4", "x = 5", "x = 17"], steps: ["Add 4: 5x = 25.", "Divide by 5: x = 5."], answer: "x = 5" },
      ],
    },
    {
      id: "brevet-algebra-factoring",
      title: "Expanding and factoring simple expressions",
      arabicTitle: "نشر وتحليل العبارات البسيطة",
      objective: "Use the distributive property in both directions.",
      worked: {
        prompt: "4(x + 3) - 2x",
        steps: ["Distribute 4: 4x + 12 - 2x.", "Combine like terms: 2x + 12.", "The simplified expression is 2x + 12."],
        answer: "2x + 12",
      },
      practice: [
        { prompt: "3(2x - 1)", options: ["6x - 1", "6x - 3", "5x - 3"], steps: ["Multiply 3 by each term: 6x - 3."], answer: "6x - 3" },
        { prompt: "6x + 18", options: ["6(x + 3)", "3(x + 6)", "6(x + 18)"], steps: ["Find the common factor 6.", "Factor 6: 6(x + 3)."], answer: "6(x + 3)" },
      ],
    },
    {
      id: "brevet-algebra-word-problems",
      title: "Turning a word problem into an equation",
      arabicTitle: "تحويل المسألة الكلامية إلى معادلة",
      objective: "Define an unknown, translate the statement, solve, and interpret the answer.",
      worked: {
        prompt: "A number increased by 8 is 23. Find the number.",
        steps: ["Let x be the unknown number.", "Translate the statement: x + 8 = 23.", "Subtract 8: x = 15.", "Check the meaning: 15 + 8 = 23."],
        answer: "The number is 15.",
      },
      practice: [
        { prompt: "Twice a number is 18.", options: ["7", "9", "36"], steps: ["Let x be the number: 2x = 18.", "Divide by 2: x = 9."], answer: "9" },
        { prompt: "A rectangle has perimeter 30 and length 10. Find its width.", options: ["5", "10", "20"], steps: ["Use P = 2(L + W): 30 = 2(10 + W).", "Divide by 2: 15 = 10 + W.", "Subtract 10: W = 5."], answer: "5" },
      ],
    },
  ],
} as const;
