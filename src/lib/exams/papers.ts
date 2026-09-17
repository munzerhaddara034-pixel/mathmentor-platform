import type { ExamTrack, OfficialPaper } from "./types";

function total(paper: Omit<OfficialPaper, "totalMarks">): OfficialPaper {
  const totalMarks = paper.parts
    .flatMap((part) => part.questions.flatMap((question) => question.subs))
    .reduce((sum, sub) => sum + sub.marks, 0);
  return { ...paper, totalMarks };
}

const brevetDemo: OfficialPaper = total({
  id: "brevet-2024-demo",
  track: "brevet",
  title: "Brevet Mathematics — Official simulation (demo)",
  titleAr: "محاكاة رسمية — شهادة المتوسطة (نموذج)",
  sessionLabel: "Session of June · Duration 20 min (demo)",
  durationMinutes: 20,
  parts: [
    {
      id: "I",
      roman: "I",
      title: "Part I — Algebra",
      titleAr: "القسم الأول — الجبر",
      questions: [
        {
          id: "b-q1",
          number: 1,
          prompt: "Consider the equation 2x + 3 = 11 and the trinomial x² − 5x + 6.",
          promptAr: "نعتبر المعادلة 2x + 3 = 11 والثلاثية x² − 5x + 6.",
          subs: [
            {
              id: "b-q1a",
              label: "1-a",
              prompt: "Solve the equation 2x + 3 = 11.",
              promptAr: "حلّ المعادلة 2x + 3 = 11.",
              latex: "2x+3=11",
              marks: 2,
              expected: ["4", "x=4", "x = 4"],
              rubric: "2 marks for the exact root x = 4.",
            },
            {
              id: "b-q1b",
              label: "1-b",
              prompt: "Factorize x² − 5x + 6.",
              promptAr: "حلّل x² − 5x + 6.",
              latex: "x^2-5x+6",
              marks: 3,
              expected: ["(x-2)(x-3)", "(x-3)(x-2)", "(x − 2)(x − 3)"],
              keywords: ["x-2", "x-3"],
              rubric: "3 marks for (x-2)(x-3); 1.5 if both roots are named without factorization.",
            },
          ],
        },
        {
          id: "b-q2",
          number: 2,
          prompt: "A bag contains 3 red balls and 5 blue balls. One ball is drawn at random.",
          promptAr: "كيس فيه 3 كرات حمراء و 5 زرقاء. نسحب كرة عشوائياً.",
          subs: [
            {
              id: "b-q2a",
              label: "2-a",
              prompt: "How many balls are in the bag?",
              promptAr: "كم كرة في الكيس؟",
              marks: 1,
              expected: ["8", "8 balls"],
              rubric: "1 mark for 8.",
            },
            {
              id: "b-q2b",
              label: "2-b",
              prompt: "Give P(red) as a simplified fraction.",
              promptAr: "أعطِ P(حمراء) ككسر مبسّط.",
              latex: "P(\\text{red})",
              marks: 2,
              expected: ["3/8", "\\frac{3}{8}"],
              rubric: "2 marks for 3/8.",
            },
          ],
        },
      ],
    },
    {
      id: "II",
      roman: "II",
      title: "Part II — Geometry",
      titleAr: "القسم الثاني — الهندسة",
      questions: [
        {
          id: "b-q3",
          number: 1,
          title: "Question 1",
          prompt: "A rectangle has length 12 cm and width 5 cm.",
          promptAr: "مستطيل طوله 12 سم وعرضه 5 سم.",
          subs: [
            {
              id: "b-q3a",
              label: "1-a",
              prompt: "Calculate the area.",
              promptAr: "احسب المساحة.",
              latex: "A=L\\times w",
              marks: 2,
              expected: ["60", "60 cm2", "60cm^2", "60 cm²"],
              rubric: "2 marks for 60 cm².",
            },
            {
              id: "b-q3b",
              label: "1-b",
              prompt: "Calculate the length of a diagonal (Pythagoras).",
              promptAr: "احسب طول القطر (فيثاغورس).",
              latex: "d=\\sqrt{12^2+5^2}",
              marks: 4,
              expected: ["13", "13 cm"],
              keywords: ["13"],
              rubric: "4 marks for 13 cm (√(144+25)=√169).",
            },
          ],
        },
      ],
    },
  ],
});

function terminalePaper(
  id: string,
  track: ExamTrack,
  title: string,
  titleAr: string,
  extraPrompt: string,
  extraAr: string,
  extraExpected: string[],
): OfficialPaper {
  return total({
    id,
    track,
    title,
    titleAr,
    sessionLabel: "Terminale official layout · 25 min demo",
    durationMinutes: 25,
    parts: [
      {
        id: "I",
        roman: "I",
        title: "Part I — Functions",
        titleAr: "القسم الأول — الدوال",
        questions: [
          {
            id: "t-q1",
            number: 1,
            prompt: "Let f be defined by f(x) = (x − 1) e^x.",
            promptAr: "لتكن f معرفة بـ f(x) = (x − 1) e^x.",
            subs: [
              {
                id: `${id}-q1a`,
                label: "1-a",
                prompt: "Determine the domain of f.",
                promptAr: "حدد مجموعة تعريف f.",
                latex: "f(x)=(x-1)e^x",
                marks: 2,
                expected: ["R", "ℝ", "\\mathbb{R}", "all real numbers", "IR"],
                keywords: ["real", "r"],
                rubric: "2 marks for ℝ.",
              },
              {
                id: `${id}-q1b`,
                label: "1-b",
                prompt: "Compute f'(x) using the product rule.",
                promptAr: "احسب f'(x) بقاعدة الجداء.",
                latex: "f'(x)=xe^x",
                marks: 4,
                expected: ["x e^x", "xe^x", "x\\mathrm{e}^x", "x e^{x}"],
                keywords: ["xe^x", "x e^x", "product"],
                rubric: "4 marks for f'(x) = x e^x.",
              },
              {
                id: `${id}-q1c`,
                label: "1-c",
                prompt: "Give lim_{x→−∞} f(x).",
                promptAr: "أعطِ نهاية f عند −∞.",
                latex: "\\lim_{x\\to-\\infty}(x-1)e^x",
                marks: 3,
                expected: ["0", "0^+", "0-"],
                rubric: "3 marks for 0 (standard limit x e^x → 0).",
              },
            ],
          },
        ],
      },
      {
        id: "II",
        roman: "II",
        title: "Part II — Complex numbers & probability",
        titleAr: "القسم الثاني — العقدية والاحتمالات",
        questions: [
          {
            id: "t-q2",
            number: 1,
            prompt: extraPrompt,
            promptAr: extraAr,
            subs: [
              {
                id: `${id}-q2a`,
                label: "1-a",
                prompt: "Write z = 3 + 4i in the form |z|(cos θ + i sin θ) by giving |z|.",
                promptAr: "اكتب z = 3 + 4i بالشكل |z|(cos θ + i sin θ) بإعطاء |z|.",
                latex: "z=3+4i",
                marks: 3,
                expected: ["5", "|z|=5"],
                rubric: "3 marks for |z| = 5.",
              },
              {
                id: `${id}-q2b`,
                label: "1-b",
                prompt: extraPrompt.includes("binomial")
                  ? "A binomial B(n=4, p=1/2): give P(X=2) as a simplified fraction."
                  : "If P(A)=0.4 and P(B)=0.5 are independent, give P(A∩B).",
                promptAr: extraAr.includes("حدانية")
                  ? "حدانية B(n=4, p=1/2): أعطِ P(X=2) ككسر مبسّط."
                  : "إذا كان P(A)=0.4 و P(B)=0.5 مستقلين، أعطِ P(A∩B).",
                latex: extraPrompt.includes("binomial") ? "P(X=2)=\\binom{4}{2}(1/2)^4" : "P(A\\cap B)=P(A)P(B)",
                marks: 4,
                expected: extraExpected,
                keywords: extraExpected,
                rubric: extraPrompt.includes("binomial") ? "4 marks for 6/16 = 3/8." : "4 marks for 0.2.",
              },
            ],
          },
        ],
      },
    ],
  });
}

const lsDemo = terminalePaper(
  "term-ls-2024-demo",
  "terminale-ls",
  "Terminale LS — Official simulation (demo)",
  "محاكاة رسمية — علوم الحياة (نموذج)",
  "Complex numbers and an independent-events probability item.",
  "أعداد عقدية ومسألة احتمال مستقلة.",
  ["0.2", "1/5", "0,2"],
);

const gsDemo = terminalePaper(
  "term-gs-2024-demo",
  "terminale-gs",
  "Terminale GS — Official simulation (demo)",
  "محاكاة رسمية — علوم عامة (نموذج)",
  "Complex numbers and a binomial probability item.",
  "أعداد عقدية ومسألة حدانية.",
  ["3/8", "6/16", "0.375"],
);

const seDemo = terminalePaper(
  "term-se-2024-demo",
  "terminale-se",
  "Terminale SE — Official simulation (demo)",
  "محاكاة رسمية — علوم اقتصادية (نموذج)",
  "Complex modulus and independent events (economics track).",
  "طويل العقدية وأحداث مستقلة (مسار اقتصاد).",
  ["0.2", "1/5"],
);

export const OFFICIAL_PAPERS: OfficialPaper[] = [brevetDemo, lsDemo, gsDemo, seDemo];

export function paperById(id: string) {
  return OFFICIAL_PAPERS.find((paper) => paper.id === id);
}

export function papersForTrack(track?: ExamTrack) {
  if (!track) return OFFICIAL_PAPERS;
  return OFFICIAL_PAPERS.filter((paper) => paper.track === track);
}

export function listSubs(paper: OfficialPaper) {
  return paper.parts.flatMap((part) =>
    part.questions.flatMap((question) =>
      question.subs.map((sub) => ({ part, question, sub })),
    ),
  );
}

export const TRACK_LABELS: Record<ExamTrack, { en: string; ar: string }> = {
  brevet: { en: "Brevet (Grade 9)", ar: "المتوسطة — Brevet" },
  "terminale-gs": { en: "Terminale GS", ar: "الثانوية — علوم عامة" },
  "terminale-ls": { en: "Terminale LS", ar: "الثانوية — علوم الحياة" },
  "terminale-se": { en: "Terminale SE", ar: "الثانوية — علوم اقتصادية" },
};
