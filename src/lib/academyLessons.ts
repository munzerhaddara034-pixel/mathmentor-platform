import type { GradeTrack, StoryboardScene } from "./types";
import { GRADE_12_LS_LIMITS_LESSON_ID, grade12LsLimitsFallbackScenes } from "./grade12LsLimits";

export type AcademyLesson = {
  id: string;
  track: GradeTrack;
  gradeLabel: string;
  chapter: number;
  title: string;
  arabicTitle: string;
  idea: string;
  board: string;
  example: string;
  exampleBoard: string;
  videoUrl?: string;
};

function L(
  track: GradeTrack,
  gradeLabel: string,
  chapter: number,
  title: string,
  arabicTitle: string,
  idea: string,
  board: string,
  example: string,
  exampleBoard: string,
  extra: Partial<Pick<AcademyLesson, "videoUrl">> = {},
): AcademyLesson {
  return { id: `${track}-ch${chapter}`, track, gradeLabel, chapter, title, arabicTitle, idea, board, example, exampleBoard, ...extra };
}

export const academyLessons: AcademyLesson[] = [
  L("grade-7", "EB7", 1, "Integers and the number line", "الأعداد الصحيحة", "Integers live on a number line. Adding a positive number moves right; adding a negative number moves left.", "Integers: … −2, −1, 0, 1, 2 …\n+ moves right\n− moves left", "Compute −3 + 8.", "−3 + 8 = 5"),
  L("grade-7", "EB7", 2, "Fractions and mixed numbers", "الكسور", "A fraction is a part of a whole. Equivalent fractions name the same point.", "a/b  with b ≠ 0\n2/4 = 1/2", "Simplify 6/8.", "6/8 = 3/4"),
  L("grade-7", "EB7", 3, "Algebraic expressions", "العبارات الجبرية", "Letters stand for numbers. Like terms can be combined.", "3x + 2x = 5x", "Simplify 4x + 7 − x.", "3x + 7"),
  L("grade-7", "EB7", 4, "Solving simple equations", "المعادلات البسيطة", "Keep the balance: do the same to both sides.", "If a = b then a + c = b + c", "Solve x + 5 = 12.", "x = 7"),
  L("grade-7", "EB7", 5, "Triangles and angles", "المثلثات والزوايا", "The three angles of a triangle add to 180 degrees.", "A + B + C = 180°", "If A = 50° and B = 60°, find C.", "C = 70°"),
  L("grade-7", "EB7", 6, "Perimeter and area", "المحيط والمساحة", "Perimeter is the fence; area is the floor.", "Rectangle: P = 2(L+W)\nA = L × W", "A 5 by 3 rectangle.", "P = 16, A = 15"),
  L("grade-7", "EB7", 7, "Reading data", "قراءة البيانات", "A table or bar chart must have a title, units, and a fair scale.", "Mean = sum / count", "Mean of 4, 6, 8.", "Mean = 6"),

  L("grade-8", "EB8", 1, "Powers and square roots", "القوى والجذور", "A power is repeated multiplication. A square root undoes a square.", "a² = a × a\n√9 = 3", "Compute 2³.", "2³ = 8"),
  L("grade-8", "EB8", 2, "Linear equations", "المعادلات الخطية", "Collect the unknown, then divide.", "ax + b = c  →  x = (c − b)/a", "Solve 3x − 4 = 11.", "x = 5"),
  L("grade-8", "EB8", 3, "Pythagoras", "فيثاغورس", "In a right triangle, the square on the hypotenuse equals the sum of the squares on the legs.", "a² + b² = c²", "Legs 3 and 4.", "c = 5"),
  L("grade-8", "EB8", 4, "Similar figures", "التشابه", "Similar shapes have equal angles and proportional sides.", "AB/A'B' = BC/B'C'", "Scale factor 2, side 5.", "Image side = 10"),
  L("grade-8", "EB8", 5, "Introduction to linear functions", "مدخل إلى الدوال الخطية", "A linear function has a constant rate of change: the slope.", "y = mx + p", "Slope of y = 2x − 1.", "m = 2"),
  L("grade-8", "EB8", 6, "Chance in simple experiments", "الاحتمال البسيط", "Probability is favorable outcomes over possible outcomes.", "P = n(A) / n(Ω)", "P(even) on a fair die.", "3/6 = 1/2"),

  L("grade-9", "EB9 / Brevet", 1, "Real numbers and algebra", "الأعداد الحقيقية والجبر", "We work on the real line with signs, powers, and order.", "ℝ : … negatives, 0, positives", "Compare √2 and 1.4.", "√2 > 1.4"),
  L("grade-9", "EB9 / Brevet", 2, "Polynomial expressions", "العبارات كثيرات الحدود", "Expand with distributivity; factor with a common factor.", "a(b+c) = ab + ac", "Expand 3(x+4).", "3x + 12"),
  L("grade-9", "EB9 / Brevet", 3, "First-degree systems", "جمل الدرجة الأولى", "Two lines meet at one point when the system has a unique solution.", "ax + by = c\ndx + ey = f", "x + y = 5, x − y = 1.", "x = 3, y = 2"),
  L("grade-9", "EB9 / Brevet", 4, "Thales and similar triangles", "طاليس والتشابه", "A line parallel to one side of a triangle cuts the other two sides proportionally.", "AM/AB = AN/AC", "If AM/AB = 1/2, then AN = AC/2.", "Midline is parallel and half."),
  L("grade-9", "EB9 / Brevet", 5, "Linear functions", "الدوال الخطية", "Graph is a straight line. Slope is rise over run.", "f(x) = ax + b\na = slope", "f(x) = −x + 3, slope?", "a = −1"),
  L("grade-9", "EB9 / Brevet", 6, "Statistics", "الإحصاء", "Organize data, then read center and spread.", "Mean, median, mode", "Median of 2, 5, 9.", "Median = 5"),
  L("grade-9", "EB9 / Brevet", 7, "Right-triangle trigonometry", "حساب مثلثات القائم", "Sine, cosine, tangent are ratios of sides.", "sin = opp/hyp\ncos = adj/hyp\ntan = opp/adj", "In a 3-4-5 triangle, sin of the angle opposite 3.", "3/5"),
  L("grade-9", "EB9 / Brevet", 8, "Space geometry", "هندسة الفضاء", "We describe cubes, boxes, and planes in space with edges and faces.", "Volume of a box = LWH", "2 × 3 × 4 box.", "V = 24"),

  L("grade-11", "S1 / Grade 11", 1, "Functions and graphs", "الدوال والرسوم", "A function assigns one output to each allowed input.", "x ↦ f(x)", "If f(x)=2x, f(5).", "10"),
  L("grade-11", "S1 / Grade 11", 2, "Limits at a point", "النهايات عند نقطة", "A limit is the value approached, not always the value attained.", "lim x→a f(x) = L", "lim x→0 (x+1).", "1"),
  L("grade-11", "S1 / Grade 11", 3, "Numerical sequences", "المتتاليات", "A sequence is a list of terms with a rule.", "u(n+1) from u(n)", "Arithmetic: 3, 7, 11.", "common difference 4"),
  L("grade-11", "S1 / Grade 11", 4, "Trigonometric equations", "المعادلات المثلثية", "Sine and cosine repeat every 2π. Solve inside one period, then add the period.", "sin x = sin α", "sin x = 0 on [0, 2π].", "x = 0 or π"),
  L("grade-11", "S1 / Grade 11", 5, "Vectors in the plane", "المتجهات في المستوى", "A vector has direction and length. Addition is tip-to-tail.", "u + v,  k·u", "|(3,4)|.", "5"),
  L("grade-11", "S1 / Grade 11", 6, "Analytic geometry", "الهندسة التحليلية", "A line has equation y = mx + p or ax + by + c = 0.", "m = (y2−y1)/(x2−x1)", "Slope through (0,1) and (2,5).", "m = 2"),

  L("grade-12", "Grade 12 LS", 1, "Limits of functions", "النهايات", "النهاية هي القيمة التي تقترب منها f(x) عندما يقترب x من a، حتى إن لم تكن f معرّفة عند a.", "lim_{x→a} f(x)=L\n0/0 → حلّل أو عقّل\nفي ∞ خذ الحد المسيطر", "احسب lim_{x→2} (x²−4)/(x−2)", "4 بعد اختزال (x−2) حيث x≠2", { videoUrl: "/videos/grade-12-ls-limits-intro.mp4" }),
  L("grade-12", "Grade 12 LS", 2, "Inverse functions", "الدوال العكسية", "An inverse undoes a function. Graphs reflect over y = x.", "f(f⁻¹(x)) = x", "If f(x)=2x, f⁻¹(x).", "x/2"),
  L("grade-12", "Grade 12 LS", 3, "Trigonometric functions", "الدوال المثلثية", "Sine and cosine oscillate between −1 and 1.", "period 2π", "sin(π/2).", "1"),
  L("grade-12", "Grade 12 LS", 4, "Vector and mixed products", "الجداء المتجهي والمختلط", "The cross product is perpendicular to both vectors.", "|u × v| = |u||v|sinθ", "i × j.", "k"),
  L("grade-12", "Grade 12 LS", 5, "Lines and planes in space", "المستقيم والمستوي في الفضاء", "A plane needs a point and a normal vector.", "ax+by+cz+d=0", "Normal of x+2y−z=0.", "(1,2,−1)"),
  L("grade-12", "Grade 12 LS", 6, "Complex numbers", "الأعداد المركبة", "A complex number is a + bi. The modulus is the length.", "|a+bi| = √(a²+b²)", "|3−4i|.", "5"),
  L("grade-12", "Grade 12 LS", 7, "Integration", "التكامل", "The integral is an antiderivative, used for area.", "∫ 2x dx = x² + C", "∫ 3 dx.", "3x + C"),
  L("grade-12", "Grade 12 LS", 8, "Logarithms", "اللوغاريتم", "Logarithms undo exponentials.", "log_a(a^x) = x", "ln e.", "1"),
  L("grade-12", "Grade 12 LS", 9, "Exponentials", "الأسي", "Exponential growth multiplies at a constant rate.", "e^{x+y} = e^x e^y", "e^0.", "1"),
  L("grade-12", "Grade 12 LS", 10, "Differential equations", "المعادلات التفاضلية", "A differential equation relates a function to its derivative.", "y' = ky", "If y' = 0, y is.", "constant"),
  L("grade-12", "Grade 12 LS", 11, "Statistics", "الإحصاء", "We summarize a sample with mean and variance.", "σ² = mean of squared deviations", "Mean of 2, 4, 6.", "4"),
  L("grade-12", "Grade 12 LS", 12, "Counting and probability", "العد والاحتمالات", "Count first, then divide.", "P(A∪B)=P(A)+P(B)−P(A∩B)", "Two fair coins, P(two heads).", "1/4"),
  L("grade-12", "Grade 12 LS", 13, "Linear systems", "الجمل الخطية", "Matrices and substitution solve several equations at once.", "AX = B", "x+y=1, x−y=1.", "x=1, y=0"),

  L("sat", "SAT Math", 1, "Heart of Algebra", "أساسيات الجبر", "Linear equations, inequalities, and systems.", "ax+b=c", "3x+5=20.", "x=5"),
  L("sat", "SAT Math", 2, "Problem solving and data", "حل المسائل والبيانات", "Rates, ratios, percentages, and graphs.", "part/whole = %", "20% of 50.", "10"),
  L("sat", "SAT Math", 3, "Passport to advanced math", "الرياضيات المتقدمة", "Quadratics, polynomials, and nonlinear expressions.", "x²−9=(x−3)(x+3)", "Positive root of x²−9=0.", "3"),
  L("sat", "SAT Math", 4, "Additional topics", "هندسة ومواضيع إضافية", "Geometry, trigonometry, and complex numbers in SAT style.", "A=πr²", "Area of radius 4.", "16π"),
];

export const gradeGroups = [
  { track: "grade-7" as GradeTrack, title: "Grade 7 · EB7" },
  { track: "grade-8" as GradeTrack, title: "Grade 8 · EB8" },
  { track: "grade-9" as GradeTrack, title: "Grade 9 · Brevet" },
  { track: "grade-11" as GradeTrack, title: "Grade 11 · Secondary 1" },
  { track: "grade-12" as GradeTrack, title: "Grade 12 · Life Sciences" },
  { track: "sat" as GradeTrack, title: "SAT Math" },
];

export function getAcademyLesson(id: string, extra: AcademyLesson[] = []) {
  return extra.concat(academyLessons).find((lesson) => lesson.id === id);
}

export function classroomScenes(lesson: AcademyLesson): StoryboardScene[] {
  if (lesson.id === GRADE_12_LS_LIMITS_LESSON_ID) return grade12LsLimitsFallbackScenes;
  const next = `Chapter ${lesson.chapter + 1} of ${lesson.gradeLabel}`;
  return [
    {
      title: "Objectives for the full hour",
      narration: `Good morning. I am Professor Munzer Haddara. Today we finish one complete lesson, not a single sentence. By the end you will state the definition of ${lesson.title}, use the board rule, solve two full examples, avoid the usual trap, and complete a check that proves you can continue. Open a clean page. Write the title now.`,
      board: `${lesson.gradeLabel} · Chapter ${lesson.chapter}\n${lesson.title}\n\nToday we will:\n1) Definition\n2) Rule on the board\n3) Two worked examples\n4) One trap\n5) Your independent check`,
      durationSeconds: 22,
    },
    {
      title: "Why this lesson matters",
      narration: `This chapter is not decoration. Certificate and SAT questions hide this idea inside word problems. If you leave with only a slogan, you will freeze in the exam. We stay until the method is automatic.`,
      board: `Exam use\n${lesson.title}\nYou must start, continue, and finish a question without asking “what now?”`,
      durationSeconds: 16,
    },
    {
      title: "What you must already know",
      narration: `Before the new idea, check yesterday. If this line is weak, write it three times. We do not build on sand.`,
      board: `Prior skill\nCopy and simplify a line of algebra.\nReplace a letter by a number and compute.`,
      durationSeconds: 14,
    },
    {
      title: "Definition — I write, you write",
      narration: `Look up. I write the definition slowly. ${lesson.idea} Do not summarise. Copy the same words. Underline the verb.`,
      board: `Definition\n${lesson.idea}`,
      durationSeconds: 20,
    },
    {
      title: "The working rule",
      narration: `Now the engine of the lesson. This is what you will use in every exercise. Copy it in a box. If the box is messy, rewrite it.`,
      board: `Rule\n${lesson.board}`,
      durationSeconds: 20,
    },
    {
      title: "Example 1 — we start",
      narration: `Example one. I read the question once. You write the given. Do not jump to the answer. ${lesson.example}`,
      board: `Example 1\nGiven:\n${lesson.example}`,
      durationSeconds: 16,
    },
    {
      title: "Example 1 — we continue",
      narration: `I apply the rule, one line at a time. If you skip a line you will lose the method in the exam. Stay with the class.`,
      board: `Example 1 · steps\nUse the rule.\n${lesson.board}\nThen compute carefully.`,
      durationSeconds: 18,
    },
    {
      title: "Example 1 — we finish",
      narration: `Here is the finished result. Box it. Then substitute back if the question allows a check. A professional student always checks.`,
      board: `Example 1 · result\n${lesson.exampleBoard}\nCheck: substitute / reread the question.`,
      durationSeconds: 16,
    },
    {
      title: "Example 2 — a second path",
      narration: `Example two uses the same rule in a slightly different costume. This is how the official exam hides the idea. Watch what changes and what stays.`,
      board: `Example 2\nSame rule, new numbers.\nStart from the definition.\nFinish with a boxed answer.`,
      durationSeconds: 18,
    },
    {
      title: "The trap",
      narration: `Most students fail here: they remember the slogan and forget the condition. I write the trap so you never copy it.`,
      board: `Trap\nDo not quote the idea and stop.\nDo not skip the check.\nDo not mix units or signs.`,
      durationSeconds: 16,
    },
    {
      title: "Your turn — independent work",
      narration: `Close the gap. You have ninety seconds. Write the given, the rule, the steps, the result. I will not talk. The class works.`,
      board: `Independent check\nRepeat Example 1 from a blank page.\nNo looking until you have an answer.`,
      durationSeconds: 18,
    },
    {
      title: "We mark together",
      narration: `Open the board. Compare line by line. If you missed a step, write it in red. That red line is your progress plan for tonight.`,
      board: `Marking\nCorrect result:\n${lesson.exampleBoard}\nProgress: one clean copy tonight.`,
      durationSeconds: 16,
    },
    {
      title: "What you can do next",
      narration: `You are not finished with mathematics today. After this video: rewrite the board from memory, then open the student chat if a step is blocked. Upload a photo of your notebook. Then continue to ${next}.`,
      board: `Next\n1) Memory rewrite\n2) Chat if stuck — send a photo\n3) ${next}`,
      durationSeconds: 18,
    },
    {
      title: "Homework and exit",
      narration: `Homework is not optional. Three questions in your notebook, each with given, rule, steps, check. Tomorrow we start from your mistakes, not from zero. Class dismissed.`,
      board: `Homework\nThree full questions on ${lesson.title}\nEach must show 4 lines: given, rule, steps, check.`,
      durationSeconds: 16,
    },
  ];
}
