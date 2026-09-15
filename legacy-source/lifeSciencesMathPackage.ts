export type LifeSciencesWorkedExample = {
  prompt: string;
  steps: string[];
  answer: string;
};

export type LifeSciencesPracticeItem = LifeSciencesWorkedExample & {
  options: string[];
};

export const lebaneseLifeSciencesMathPackage = {
  id: "lebanese-s3ls-mathematics-foundations",
  title: "Lebanese Secondary Certificate · Life Sciences Mathematics",
  arabicTitle: "الشهادة الثانوية اللبنانية · رياضيات فرع علوم الحياة",
  grade: "S3LS",
  branch: "Life Sciences",
  source: "CRDP Lebanese Curriculum Digital Library · S3LS · Mathematics",
  sourceUrl: "https://mawaridy.crdp.org/Library/index/1",
  reviewStatus: "Professor and official-plan review required",
  note: "Original academy explanations aligned to the reference topic areas; textbook wording and official answer keys are not reproduced.",
  lessons: [
    {
      id: "s3ls-functions-and-variation",
      title: "Functions, limits, and variation",
      arabicTitle: "الدوال والنهايات وجدول التغيّر",
      objective: "Read a function, evaluate a limit, and use the derivative sign to describe variation.",
      worked: {
        prompt: "For f(x) = x² − 4x + 3, find the vertex and the intervals of variation.",
        steps: ["Complete the square: f(x) = (x − 2)² − 1.", "The vertex is V(2, −1), so the minimum value is −1.", "Differentiate: f′(x) = 2x − 4.", "f′(x) < 0 when x < 2 and f′(x) > 0 when x > 2.", "Therefore f decreases on (−∞, 2) and increases on (2, +∞)."],
        answer: "V(2, −1); decreasing before x = 2 and increasing after x = 2.",
      },
      practice: [
        { prompt: "Evaluate lim x→2 (x² − 4)/(x − 2).", options: ["0", "4", "2"], steps: ["Factor the numerator: x² − 4 = (x − 2)(x + 2).", "Cancel x − 2 for x ≠ 2.", "Evaluate x + 2 at x = 2: 4."], answer: "4" },
        { prompt: "Find f′(x) for f(x) = 3x³ − 5x.", options: ["9x² − 5", "3x² − 5", "9x³ − 5"], steps: ["Differentiate term by term: (3x³)′ = 9x² and (−5x)′ = −5.", "So f′(x) = 9x² − 5."], answer: "9x² − 5" },
      ],
    },
    {
      id: "s3ls-probability-and-statistics",
      title: "Probability and statistical interpretation",
      arabicTitle: "الاحتمالات وقراءة المعطيات الإحصائية",
      objective: "Use conditional probability and expected value to interpret a finite experiment.",
      worked: {
        prompt: "A bag contains 3 red and 2 blue balls. Two balls are drawn without replacement. Find P(second is blue | first is red).",
        steps: ["After a red ball is drawn, 4 balls remain: 2 red and 2 blue.", "There are 2 blue outcomes among the 4 remaining balls.", "Thus P(second blue | first red) = 2/4 = 1/2."],
        answer: "1/2",
      },
      practice: [
        { prompt: "A fair die is rolled once. Find the expected value.", options: ["3", "3.5", "6"], steps: ["All outcomes 1 through 6 have probability 1/6.", "E = (1 + 2 + 3 + 4 + 5 + 6)/6 = 21/6 = 3.5."], answer: "3.5" },
        { prompt: "If P(A) = 0.6 and P(B|A) = 0.5, find P(A∩B).", options: ["0.3", "0.5", "1.1"], steps: ["Use P(A∩B) = P(A) × P(B|A).", "Compute 0.6 × 0.5 = 0.3."], answer: "0.3" },
      ],
    },
    {
      id: "s3ls-vectors-and-geometry",
      title: "Vectors and analytic geometry",
      arabicTitle: "المتجهات والهندسة التحليلية",
      objective: "Use coordinates and vectors to test alignment and calculate a distance.",
      worked: {
        prompt: "Given A(1, 2) and B(5, 5), find vector AB and its length.",
        steps: ["Subtract coordinates: AB = (5 − 1, 5 − 2) = (4, 3).", "Use the distance formula: |AB| = √(4² + 3²).", "Simplify: |AB| = √25 = 5."],
        answer: "AB = (4, 3) and |AB| = 5.",
      },
      practice: [
        { prompt: "Are A(0, 1), B(2, 5), and C(3, 7) aligned?", options: ["Yes", "No", "Only if x = 1"], steps: ["AB = (2, 4) and AC = (3, 6).", "AC = 1.5 × AB, so the vectors are proportional.", "Therefore the three points are aligned."], answer: "Yes" },
        { prompt: "Find the midpoint of A(−2, 4) and B(6, 0).", options: ["(2, 2)", "(4, 4)", "(−4, 2)"], steps: ["Average the x-coordinates: (−2 + 6)/2 = 2.", "Average the y-coordinates: (4 + 0)/2 = 2."], answer: "(2, 2)" },
      ],
    },
    {
      id: "s3ls-exam-strategy-and-modeling",
      title: "Exam strategy: modeling a real situation",
      arabicTitle: "استراتيجية الامتحان: نمذجة وضعية واقعية",
      objective: "Translate a contextual problem into a model, solve it, and interpret the result with units.",
      worked: {
        prompt: "A population model is P(t) = 1200e^{0.04t}. Estimate P(5) to the nearest whole number.",
        steps: ["Substitute t = 5: P(5) = 1200e^{0.2}.", "Use e^{0.2} ≈ 1.2214.", "Multiply: 1200 × 1.2214 ≈ 1465.7.", "Round to the nearest whole number and keep the population unit."],
        answer: "P(5) ≈ 1,466 units.",
      },
      practice: [
        { prompt: "If a quantity decreases by 10% from 500, what is the new value?", options: ["450", "490", "550"], steps: ["A 10% decrease leaves 90%.", "Compute 0.90 × 500 = 450."], answer: "450" },
        { prompt: "A model gives 2x + 6 = 18. What is x and what should be checked?", options: ["x = 6; units and context", "x = 12; no check", "x = 3; ignore context"], steps: ["Subtract 6: 2x = 12.", "Divide by 2: x = 6.", "Check by substitution and confirm that x fits the units and context."], answer: "x = 6; units and context" },
      ],
    },
    {
      id: "s3ls-integration-and-applications",
      title: "Integration and accumulation",
      arabicTitle: "التكامل وتطبيقاته",
      objective: "Recognize an antiderivative, apply a condition, and interpret accumulated change.",
      worked: {
        prompt: "Find F(x) if F′(x) = 3x² − 4 and F(1) = 2.",
        steps: ["Integrate term by term: F(x) = x³ − 4x + C.", "Use F(1) = 2: 1 − 4 + C = 2, so C = 5.", "Therefore F(x) = x³ − 4x + 5."],
        answer: "F(x) = x³ − 4x + 5.",
      },
      practice: [
        { prompt: "An antiderivative of 6x is:", options: ["3x² + C", "6x² + C", "x⁶ + C"], steps: ["Use ∫6x dx = 6·x²/2 + C.", "Simplify to 3x² + C."], answer: "3x² + C" },
        { prompt: "Compute ∫₀² x dx.", options: ["1", "2", "4"], steps: ["An antiderivative of x is x²/2.", "Evaluate: 2²/2 − 0²/2 = 2."], answer: "2" },
      ],
    },
    {
      id: "s3ls-logarithmic-exponential-models",
      title: "Logarithmic and exponential models",
      arabicTitle: "النماذج اللوغاريتمية والأسية",
      objective: "Solve a logarithmic equation and interpret an exponential model with valid-domain checks.",
      worked: {
        prompt: "Solve ln(x) + ln(2) = ln(10).",
        steps: ["Combine logarithms: ln(2x) = ln(10).", "Since ln is one-to-one on positive numbers, 2x = 10.", "Solve x = 5 and verify x > 0."],
        answer: "x = 5.",
      },
      practice: [
        { prompt: "Solve e^x = e^3.", options: ["x = 1", "x = 3", "x = e³"], steps: ["The exponential function is one-to-one.", "Therefore x = 3."], answer: "x = 3" },
        { prompt: "For g(x) = ln(x − 1), what is the domain?", options: ["x > 1", "x ≥ 1", "all real x"], steps: ["A natural logarithm requires a positive argument.", "Require x − 1 > 0, so x > 1."], answer: "x > 1" },
      ],
    },
    {
      id: "s3ls-counting-and-probability-models",
      title: "Counting and probability models",
      arabicTitle: "العدّ ونماذج الاحتمالات",
      objective: "Choose an appropriate counting model and calculate a probability without replacement.",
      worked: {
        prompt: "How many two-person teams can be chosen from 5 students?",
        steps: ["Order does not matter, so use combinations.", "Compute C(5,2) = 5·4/(2·1) = 10."],
        answer: "10 teams.",
      },
      practice: [
        { prompt: "How many arrangements are possible for 3 distinct books?", options: ["3", "6", "9"], steps: ["Arrange the first, second, and third books: 3! = 3·2·1.", "Thus there are 6 arrangements."], answer: "6" },
        { prompt: "A box has 4 green and 1 red token. What is P(red)?", options: ["1/4", "1/5", "4/5"], steps: ["There is 1 favorable token among 5 total tokens.", "Therefore P(red) = 1/5."], answer: "1/5" },
      ],
    },
    {
      id: "s3ls-linear-systems-and-parameters",
      title: "Linear systems and parameters",
      arabicTitle: "الأنظمة الخطية والمعلمات",
      objective: "Solve a two-variable system and test whether a parameter produces a unique solution.",
      worked: {
        prompt: "Solve x + y = 7 and x − y = 1.",
        steps: ["Add the equations: 2x = 8.", "Divide by 2: x = 4.", "Substitute into x + y = 7: y = 3."],
        answer: "(x, y) = (4, 3).",
      },
      practice: [
        { prompt: "Solve 2x + y = 9 and x + y = 6.", options: ["(3, 3)", "(4, 1)", "(2, 5)"], steps: ["Subtract the second equation from the first: x = 3.", "Substitute: 3 + y = 6, so y = 3."], answer: "(3, 3)" },
        { prompt: "When two equations represent the same line, the system has:", options: ["No solution", "One solution", "Infinitely many solutions"], steps: ["Identical equations describe every point on one line.", "Therefore the system has infinitely many solutions."], answer: "Infinitely many solutions" },
      ],
    },
  ],
} as const;
