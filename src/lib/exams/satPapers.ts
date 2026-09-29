import type { OfficialPaper } from "./types";

function total(paper: Omit<OfficialPaper, "totalMarks">): OfficialPaper {
  const totalMarks = paper.parts
    .flatMap((part) => part.questions.flatMap((question) => question.subs))
    .reduce((sum, sub) => sum + sub.marks, 0);
  return { ...paper, totalMarks };
}

/**
 * Original MathMentor platform SAT-style practice (تدريب المنصة).
 * Not College Board verbatim — original numbers and wording.
 * Official CB PDFs are linked only from /exams (see officialSatBlueprint).
 */
export const satPractice1: OfficialPaper = total({
  id: "sat-math-practice-1",
  track: "sat",
  title: "Platform practice 1 — Algebra & Advanced Math",
  titleAr: "تدريب المنصة ١ — جبر ورياضيات متقدمة",
  sessionLabel: "Digital SAT Math style · 35 min demo · Calculator allowed",
  durationMinutes: 35,
  parts: [
    {
      id: "A",
      roman: "A",
      title: "Algebra (Heart of Algebra)",
      titleAr: "الجبر",
      questions: [
        {
          id: "sat1-q1",
          number: 1,
          prompt: "Linear equation in one variable.",
          promptAr: "معادلة خطية بمتغير واحد.",
          subs: [
            {
              id: "sat1-q1a",
              label: "1",
              prompt: "If $$3x + 7 = 22$$, what is the value of $$x$$?",
              promptAr: "إذا كان $$3x + 7 = 22$$، فما قيمة $$x$$؟",
              latex: "3x+7=22",
              marks: 1,
              expected: ["5", "x=5", "x = 5"],
              responseType: "mcq",
              skill: "linear-equation",
              choices: [
                { id: "A", text: "3" },
                { id: "B", text: "5" },
                { id: "C", text: "7" },
                { id: "D", text: "15" },
              ],
              rubric: "1 point for B / 5.",
              solution: "Subtract 7: $$3x=15$$. Divide by 3: $$x=5$$.",
            },
          ],
        },
        {
          id: "sat1-q2",
          number: 2,
          prompt: "System of two linear equations.",
          promptAr: "جملة معادلتين خطيتين.",
          subs: [
            {
              id: "sat1-q2a",
              label: "2",
              prompt:
                "The system $$\\begin{cases} 2x+y=11 \\\\ x-y=1 \\end{cases}$$ has solution $$(x,y)$$. What is $$x+y$$?",
              promptAr: "جملة المعادلتين. ما قيمة $$x+y$$؟",
              latex: "2x+y=11,\\quad x-y=1",
              marks: 1,
              expected: ["7", "x+y=7"],
              keywords: ["7"],
              responseType: "spr",
              skill: "linear-system",
              rubric: "1 point for 7 (student-produced response).",
              solution: "Add the equations: $$3x=12\\Rightarrow x=4$$. Then $$y=3$$, so $$x+y=7$$.",
            },
          ],
        },
        {
          id: "sat1-q3",
          number: 3,
          prompt: "Linear inequality.",
          promptAr: "متباينة خطية.",
          subs: [
            {
              id: "sat1-q3a",
              label: "3",
              prompt: "Which value of $$n$$ satisfies $$4n-9\\le 7$$?",
              promptAr: "أي قيمة تحقق المتباينة؟",
              latex: "4n-9\\le 7",
              marks: 1,
              expected: ["A", "3", "n=3"],
              responseType: "mcq",
              skill: "linear-inequality",
              choices: [
                { id: "A", text: "3" },
                { id: "B", text: "5" },
                { id: "C", text: "6" },
                { id: "D", text: "8" },
              ],
              rubric: "1 point for A ($$n\\le 4$$; 3 works).",
              solution: "$$4n\\le 16\\Rightarrow n\\le 4$$. Only 3 among the choices satisfies.",
            },
          ],
        },
      ],
    },
    {
      id: "B",
      roman: "B",
      title: "Advanced Math (Passport)",
      titleAr: "الرياضيات المتقدمة",
      questions: [
        {
          id: "sat1-q4",
          number: 4,
          prompt: "Quadratic factorization.",
          promptAr: "تحليل ثلاثية.",
          subs: [
            {
              id: "sat1-q4a",
              label: "4",
              prompt: "Which is equivalent to $$x^{2}-5x+6$$?",
              promptAr: "ما المكافئ لـ $$x^{2}-5x+6$$؟",
              latex: "x^{2}-5x+6",
              marks: 1,
              expected: ["B", "(x-2)(x-3)"],
              responseType: "mcq",
              skill: "quadratic-factor",
              choices: [
                { id: "A", text: "(x-1)(x-6)" },
                { id: "B", text: "(x-2)(x-3)" },
                { id: "C", text: "(x+2)(x+3)" },
                { id: "D", text: "(x-2)(x+3)" },
              ],
              rubric: "1 point for B.",
              solution: "Roots 2 and 3: $$(x-2)(x-3)=x^{2}-5x+6$$.",
            },
          ],
        },
        {
          id: "sat1-q5",
          number: 5,
          prompt: "Exponential growth model.",
          promptAr: "نموذج نمو أسي.",
          subs: [
            {
              id: "sat1-q5a",
              label: "5",
              prompt:
                "A population is modeled by $$P(t)=800\\cdot(1.05)^{t}$$. What is $$P(0)$$?",
              promptAr: "ما قيمة $$P(0)$$؟",
              latex: "P(t)=800(1.05)^{t}",
              marks: 1,
              expected: ["800", "P(0)=800"],
              responseType: "spr",
              skill: "exponential-model",
              rubric: "1 point for 800.",
              solution: "$$(1.05)^{0}=1$$, so $$P(0)=800$$.",
            },
          ],
        },
        {
          id: "sat1-q6",
          number: 6,
          prompt: "Nonlinear expression.",
          promptAr: "تعبير غير خطي.",
          subs: [
            {
              id: "sat1-q6a",
              label: "6",
              prompt: "If $$\\frac{2x+4}{x+2}=k$$ for $$x\\neq -2$$, what is $$k$$?",
              promptAr: "ما قيمة $$k$$؟",
              latex: "\\frac{2x+4}{x+2}=k",
              marks: 1,
              expected: ["C", "2", "k=2"],
              responseType: "mcq",
              skill: "rational-simplify",
              choices: [
                { id: "A", text: "0" },
                { id: "B", text: "1" },
                { id: "C", text: "2" },
                { id: "D", text: "4" },
              ],
              rubric: "1 point for C.",
              solution: "$$\\frac{2(x+2)}{x+2}=2$$ for $$x\\neq -2$$.",
            },
          ],
        },
      ],
    },
    {
      id: "C",
      roman: "C",
      title: "Problem Solving & Data / Geometry warm-up",
      titleAr: "حل مسائل وبيانات / هندسة",
      questions: [
        {
          id: "sat1-q7",
          number: 7,
          prompt: "Percent and ratio.",
          promptAr: "نسبة مئوية.",
          subs: [
            {
              id: "sat1-q7a",
              label: "7",
              prompt: "What is 15% of 80?",
              promptAr: "ما هو 15% من 80؟",
              latex: "0.15\\times 80",
              marks: 1,
              expected: ["12"],
              responseType: "spr",
              skill: "percent",
              rubric: "1 point for 12.",
              solution: "$$\\frac{15}{100}\\times 80=12$$.",
            },
          ],
        },
        {
          id: "sat1-q8",
          number: 8,
          prompt: "Right triangle.",
          promptAr: "مثلث قائم.",
          subs: [
            {
              id: "sat1-q8a",
              label: "8",
              prompt:
                "A right triangle has legs 6 and 8. What is the length of the hypotenuse?",
              promptAr: "مثلث قائم ساقاه 6 و 8. ما طول الوتر؟",
              latex: "c=\\sqrt{6^{2}+8^{2}}",
              marks: 1,
              expected: ["B", "10"],
              responseType: "mcq",
              skill: "pythagoras",
              choices: [
                { id: "A", text: "7" },
                { id: "B", text: "10" },
                { id: "C", text: "12" },
                { id: "D", text: "14" },
              ],
              rubric: "1 point for B.",
              solution: "$$\\sqrt{36+64}=\\sqrt{100}=10$$.",
            },
          ],
        },
      ],
    },
  ],
});

export const satPractice2: OfficialPaper = total({
  id: "sat-math-practice-2",
  track: "sat",
  title: "Platform practice 2 — Data, Geometry & Trig",
  titleAr: "تدريب المنصة ٢ — بيانات وهندسة ومثلثات",
  sessionLabel: "Digital SAT Math style · 35 min demo · Calculator allowed",
  durationMinutes: 35,
  parts: [
    {
      id: "A",
      roman: "A",
      title: "Problem-Solving and Data Analysis",
      titleAr: "حل المسائل وتحليل البيانات",
      questions: [
        {
          id: "sat2-q1",
          number: 1,
          prompt: "Unit rate.",
          promptAr: "معدل وحدة.",
          subs: [
            {
              id: "sat2-q1a",
              label: "1",
              prompt: "A car travels 180 miles in 3 hours at constant speed. What is the speed in miles per hour?",
              promptAr: "ما السرعة بالميل في الساعة؟",
              latex: "v=\\frac{180}{3}",
              marks: 1,
              expected: ["60"],
              responseType: "spr",
              skill: "unit-rate",
              rubric: "1 point for 60.",
              solution: "$$\\frac{180}{3}=60$$ mph.",
            },
          ],
        },
        {
          id: "sat2-q2",
          number: 2,
          prompt: "Mean of a data set.",
          promptAr: "متوسط مجموعة بيانات.",
          subs: [
            {
              id: "sat2-q2a",
              label: "2",
              prompt: "The scores 70, 80, 90, and 100 have mean",
              promptAr: "متوسط العلامات 70، 80، 90، 100 هو",
              latex: "\\frac{70+80+90+100}{4}",
              marks: 1,
              expected: ["C", "85"],
              responseType: "mcq",
              skill: "mean",
              choices: [
                { id: "A", text: "80" },
                { id: "B", text: "82.5" },
                { id: "C", text: "85" },
                { id: "D", text: "90" },
              ],
              rubric: "1 point for C.",
              solution: "Sum $$340$$; divide by 4: $$85$$.",
            },
          ],
        },
        {
          id: "sat2-q3",
          number: 3,
          prompt: "Scatterplot / linear model interpretation.",
          promptAr: "تفسير نموذج خطي.",
          subs: [
            {
              id: "sat2-q3a",
              label: "3",
              prompt:
                "A line of best fit is $$y=2.5x+10$$, where $$x$$ is hours studied and $$y$$ is predicted score. What does the slope 2.5 mean?",
              promptAr: "ماذا يعني الميل 2.5؟",
              latex: "y=2.5x+10",
              marks: 1,
              expected: ["B"],
              responseType: "mcq",
              skill: "slope-meaning",
              choices: [
                { id: "A", text: "Predicted score with 0 hours is 2.5" },
                { id: "B", text: "Each extra hour raises predicted score by 2.5" },
                { id: "C", text: "Maximum score is 2.5" },
                { id: "D", text: "Hours must be multiples of 2.5" },
              ],
              rubric: "1 point for B.",
              solution: "Slope = change in $$y$$ per unit $$x$$: +2.5 points per hour.",
            },
          ],
        },
      ],
    },
    {
      id: "B",
      roman: "B",
      title: "Geometry and Trigonometry",
      titleAr: "الهندسة والمثلثات",
      questions: [
        {
          id: "sat2-q4",
          number: 4,
          prompt: "Circle area.",
          promptAr: "مساحة دائرة.",
          subs: [
            {
              id: "sat2-q4a",
              label: "4",
              prompt: "A circle has radius 4. What is its area?",
              promptAr: "دائرة نصف قطرها 4. ما مساحتها؟",
              latex: "A=\\pi r^{2}",
              marks: 1,
              expected: ["B", "16\\pi", "16pi"],
              responseType: "mcq",
              skill: "circle-area",
              choices: [
                { id: "A", text: "8π" },
                { id: "B", text: "16π" },
                { id: "C", text: "32π" },
                { id: "D", text: "64π" },
              ],
              rubric: "1 point for B.",
              solution: "$$A=\\pi\\cdot 4^{2}=16\\pi$$.",
            },
          ],
        },
        {
          id: "sat2-q5",
          number: 5,
          prompt: "Similar triangles.",
          promptAr: "مثلثات متشابهة.",
          subs: [
            {
              id: "sat2-q5a",
              label: "5",
              prompt:
                "Triangles are similar with side ratio $$\\frac{3}{5}$$. If the larger triangle has a side of length 20, the corresponding side of the smaller is",
              promptAr: "الضلع المقابل في المثلث الأصغر هو",
              latex: "\\frac{3}{5}=\\frac{s}{20}",
              marks: 1,
              expected: ["12"],
              responseType: "spr",
              skill: "similar-triangles",
              rubric: "1 point for 12.",
              solution: "$$s=20\\cdot\\frac{3}{5}=12$$.",
            },
          ],
        },
        {
          id: "sat2-q6",
          number: 6,
          prompt: "Right-triangle trigonometry.",
          promptAr: "مثلثيات مثلث قائم.",
          subs: [
            {
              id: "sat2-q6a",
              label: "6",
              prompt:
                "In a right triangle, $$\\sin\\theta=\\frac{3}{5}$$. What is $$\\cos\\theta$$ if $$\\theta$$ is acute?",
              promptAr: "ما قيمة $$\\cos\\theta$$؟",
              latex: "\\sin\\theta=\\frac{3}{5}",
              marks: 1,
              expected: ["C", "4/5", "\\frac{4}{5}", "0.8"],
              responseType: "mcq",
              skill: "trig-ratio",
              choices: [
                { id: "A", text: "3/5" },
                { id: "B", text: "3/4" },
                { id: "C", text: "4/5" },
                { id: "D", text: "5/3" },
              ],
              rubric: "1 point for C.",
              solution: "3-4-5 triangle: adjacent 4, hypotenuse 5, so $$\\cos\\theta=\\frac{4}{5}$$.",
            },
          ],
        },
      ],
    },
    {
      id: "C",
      roman: "C",
      title: "Algebra mixed / Additional topics",
      titleAr: "جبر مختلط ومواضيع إضافية",
      questions: [
        {
          id: "sat2-q7",
          number: 7,
          prompt: "Function evaluation.",
          promptAr: "حساب قيمة دالة.",
          subs: [
            {
              id: "sat2-q7a",
              label: "7",
              prompt: "If $$f(x)=2x^{2}-3x+1$$, what is $$f(2)$$?",
              promptAr: "ما قيمة $$f(2)$$؟",
              latex: "f(x)=2x^{2}-3x+1",
              marks: 1,
              expected: ["3", "f(2)=3"],
              responseType: "spr",
              skill: "function-eval",
              rubric: "1 point for 3.",
              solution: "$$f(2)=2\\cdot 4-6+1=8-6+1=3$$.",
            },
          ],
        },
        {
          id: "sat2-q8",
          number: 8,
          prompt: "Absolute value equation.",
          promptAr: "معادلة قيمة مطلقة.",
          subs: [
            {
              id: "sat2-q8a",
              label: "8",
              prompt: "How many real solutions does $$|x-4|=6$$ have?",
              promptAr: "كم حلاً حقيقياً لـ $$|x-4|=6$$؟",
              latex: "|x-4|=6",
              marks: 1,
              expected: ["B", "2"],
              responseType: "mcq",
              skill: "absolute-value",
              choices: [
                { id: "A", text: "0" },
                { id: "B", text: "2" },
                { id: "C", text: "1" },
                { id: "D", text: "4" },
              ],
              rubric: "1 point for B.",
              solution: "$$x-4=6$$ or $$x-4=-6$$ → $$x=10$$ or $$x=-2$$: two solutions.",
            },
          ],
        },
      ],
    },
  ],
});

export const SAT_PAPERS: OfficialPaper[] = [satPractice1, satPractice2];
