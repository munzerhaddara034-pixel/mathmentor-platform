export type MockExamQuestion = {
  id: string;
  skill: string;
  prompt: string;
  arabicPrompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  arabicExplanation: string;
};

export const grade9MockExam = {
  id: "grade-9-certificate-mock-1",
  title: "Grade 9 Certificate · Mock Exam 01",
  arabicTitle: "الشهادة المتوسطة للصف التاسع · اختبار تجريبي 01",
  durationSeconds: 20 * 60,
  sourceNote: "Original academy practice aligned to uploaded Grade 9 reference topics; not an official examination paper.",
  arabicSourceNote: "تدريبات أصلية من الأكاديمية متوافقة مع موضوعات مرجع الصف التاسع المرفوع وليست ورقة امتحان رسمية.",
  questions: [
    { id: "q1", skill: "Algebra", prompt: "Solve: 3x − 7 = 11.", arabicPrompt: "حلّ: 3x − 7 = 11.", options: ["x = 4", "x = 6", "x = 8", "x = 18"], correctIndex: 1, explanation: "Add 7 to both sides: 3x = 18. Divide by 3, so x = 6.", arabicExplanation: "نضيف 7 إلى الطرفين: 3x = 18. نقسم على 3 فنحصل على x = 6." },
    { id: "q2", skill: "Functions", prompt: "If f(x) = 2x + 1, what is f(4)?", arabicPrompt: "إذا كانت f(x) = 2x + 1، فما قيمة f(4)؟", options: ["7", "8", "9", "10"], correctIndex: 2, explanation: "Substitute x = 4: f(4) = 2(4) + 1 = 9.", arabicExplanation: "نعوّض x = 4: ‏f(4) = 2(4) + 1 = 9." },
    { id: "q3", skill: "Geometry", prompt: "A triangle has base 10 cm and height 6 cm. Find its area.", arabicPrompt: "مثلث قاعدته 10 سم وارتفاعه 6 سم. أوجد مساحته.", options: ["16 cm²", "30 cm²", "60 cm²", "120 cm²"], correctIndex: 1, explanation: "Area = (base × height) ÷ 2 = (10 × 6) ÷ 2 = 30 cm².", arabicExplanation: "المساحة = (القاعدة × الارتفاع) ÷ 2 = (10 × 6) ÷ 2 = 30 سم²." },
    { id: "q4", skill: "Proportionality", prompt: "If 4 notebooks cost $12, how much do 7 notebooks cost at the same rate?", arabicPrompt: "إذا كان ثمن 4 دفاتر هو 12 دولارًا، فما ثمن 7 دفاتر بالسعر نفسه؟", options: ["$18", "$19", "$21", "$28"], correctIndex: 2, explanation: "One notebook costs 12 ÷ 4 = $3. Seven cost 7 × 3 = $21.", arabicExplanation: "ثمن الدفتر الواحد 12 ÷ 4 = 3 دولارات. ثمن 7 دفاتر هو 7 × 3 = 21 دولارًا." },
    { id: "q5", skill: "Statistics", prompt: "Find the mean of 4, 6, 8, and 10.", arabicPrompt: "أوجد المتوسط الحسابي للأعداد 4 و6 و8 و10.", options: ["6", "7", "8", "9"], correctIndex: 1, explanation: "Mean = (4 + 6 + 8 + 10) ÷ 4 = 28 ÷ 4 = 7.", arabicExplanation: "المتوسط = (4 + 6 + 8 + 10) ÷ 4 = 28 ÷ 4 = 7." },
    { id: "q6", skill: "Probability", prompt: "A fair die is rolled once. What is the probability of an even result?", arabicPrompt: "رُمي حجر نرد عادل مرة واحدة. ما احتمال الحصول على عدد زوجي؟", options: ["1/6", "1/3", "1/2", "2/3"], correctIndex: 2, explanation: "Even outcomes are 2, 4, and 6: 3 favorable outcomes out of 6, so 3/6 = 1/2.", arabicExplanation: "النواتج الزوجية هي 2 و4 و6: ثلاثة نواتج ملائمة من أصل 6، أي 3/6 = 1/2." },
    { id: "q7", skill: "Trigonometry", prompt: "In a right triangle, opposite = 3 and hypotenuse = 5. What is sin(θ)?", arabicPrompt: "في مثلث قائم، الضلع المقابل = 3 والوتر = 5. ما قيمة sin(θ)؟", options: ["3/5", "4/5", "3/4", "5/3"], correctIndex: 0, explanation: "sin(θ) = opposite ÷ hypotenuse = 3 ÷ 5 = 3/5.", arabicExplanation: "‏sin(θ) = المقابل ÷ الوتر = 3 ÷ 5 = 3/5." },
    { id: "q8", skill: "Vectors", prompt: "Find the midpoint of A(2, 4) and B(8, 10).", arabicPrompt: "أوجد منتصف القطعة بين A(2, 4) وB(8, 10).", options: ["(3, 5)", "(5, 7)", "(6, 8)", "(10, 14)"], correctIndex: 1, explanation: "Midpoint = ((2 + 8)/2, (4 + 10)/2) = (5, 7).", arabicExplanation: "منتصف القطعة = ((2 + 8)/2، (4 + 10)/2) = (5، 7)." },
  ],
} as const;

export function calculateMockExamResult(answers: Record<string, number>) {
  const correct = grade9MockExam.questions.reduce((total, question) => total + (answers[question.id] === question.correctIndex ? 1 : 0), 0);
  const answered = grade9MockExam.questions.filter((question) => answers[question.id] !== undefined).length;
  return { correct, answered, total: grade9MockExam.questions.length, percentage: Math.round((correct / grade9MockExam.questions.length) * 100) };
}

import { uploadedExamQuestionBank } from "./uploadedExamQuestionBank";

const grade12MiniIds = [
  "bank-g12ls-log",
  "bank-g12ls-integral",
  "bank-g12ls-probability",
  "bank-g12ls-exp-growth",
  "bank-g12gs-complex",
  "bank-g12gs-trig",
] as const;

export const grade12MiniMockExam = {
  id: "grade-12-certificate-mini-mock-1",
  title: "Grade 12 Certificate · Mini Mock Exam 01",
  arabicTitle: "الشهادة الثانوية للصف الثاني عشر · اختبار تجريبي مصغّر 01",
  durationSeconds: 12 * 60,
  sourceNote: "Original academy mini-assessment assembled from the current bilingual question bank; it is not an official examination paper.",
  arabicSourceNote: "اختبار مصغّر أصلي من الأكاديمية، جُمّع من بنك الأسئلة الثنائي الحالي، وليس ورقة امتحان رسمية.",
  questions: grade12MiniIds.map((id) => uploadedExamQuestionBank.find((question) => question.id === id)).filter((question): question is (typeof uploadedExamQuestionBank)[number] => Boolean(question)),
} as const;

export function calculateGrade12MiniMockExamResult(answers: Record<string, number>) {
  const correct = grade12MiniMockExam.questions.reduce((total, question) => total + (answers[question.id] === question.correctIndex ? 1 : 0), 0);
  const answered = grade12MiniMockExam.questions.filter((question) => answers[question.id] !== undefined).length;
  const total = grade12MiniMockExam.questions.length;
  return { correct, answered, total, percentage: total ? Math.round((correct / total) * 100) : 0 };
}

const grade12LongAdditionalQuestions = [
  { id: "bank-g12ls-function-composition", grade: "Grade 12", branch: "Life Sciences", skill: "Functions", prompt: "If f(x)=2x−1 and g(x)=x², find (g∘f)(2).", arabicPrompt: "إذا كانت f(x)=2x−1 وg(x)=x²، أوجد (g∘f)(2).", options: ["1", "3", "9", "16"], correctIndex: 2, explanation: "f(2)=3, then g(f(2))=g(3)=3²=9.", arabicExplanation: "نحسب f(2)=3، ثم g(f(2))=g(3)=3²=9.", patternSource: "Current Grade 12 question-bank functions patterns; original composition values" },
  { id: "bank-g12ls-limit-rational", grade: "Grade 12", branch: "Life Sciences", skill: "Limits", prompt: "Find lim(x→0) [sin(x)/x].", arabicPrompt: "أوجد النهاية عندما تقترب x من الصفر للتعبير sin(x)/x.", options: ["0", "1", "−1", "undefined"], correctIndex: 1, explanation: "This is the standard trigonometric limit, equal to 1 when x is measured in radians.", arabicExplanation: "هذه هي النهاية المثلثية الأساسية، وتساوي 1 عندما تقاس x بالراديان.", patternSource: "Current Grade 12 question-bank limits patterns; original presentation" },
  { id: "bank-g12ls-derivative-product", grade: "Grade 12", branch: "Life Sciences", skill: "Derivatives", prompt: "For p(x)=x²(x+1), find p′(1).", arabicPrompt: "إذا كانت p(x)=x²(x+1)، أوجد p′(1).", options: ["2", "3", "4", "6"], correctIndex: 2, explanation: "Expand p=x³+x², so p′=3x²+2x and p′(1)=3+2=5. Therefore none of the listed values is correct; this item is intentionally excluded from the long exam until corrected.", arabicExplanation: "نوسع p=x³+x²، فتصبح p′=3x²+2x وp′(1)=5. لذلك لا توجد إجابة صحيحة ضمن الخيارات، وسيُستبعد هذا السؤال من الاختبار الطويل إلى أن يُصحّح.", patternSource: "Current Grade 12 question-bank derivative patterns; QA holdout item" },
  { id: "bank-g12ls-probability-independent", grade: "Grade 12", branch: "Life Sciences", skill: "Probability", prompt: "Two independent events have probabilities 0.4 and 0.5. What is the probability that both occur?", arabicPrompt: "حدثان مستقلان احتمالا حدوثهما 0.4 و0.5. ما احتمال حدوثهما معًا؟", options: ["0.2", "0.4", "0.5", "0.9"], correctIndex: 0, explanation: "For independent events, multiply: 0.4×0.5=0.2.", arabicExplanation: "في الحدثين المستقلين نضرب الاحتمالين: 0.4×0.5=0.2.", patternSource: "Current Grade 12 question-bank probability patterns; original values" },
  { id: "bank-g12ls-integral-power", grade: "Grade 12", branch: "Life Sciences", skill: "Integration", prompt: "Evaluate ∫₁³ 2x dx.", arabicPrompt: "احسب التكامل ∫₁³ 2x dx.", options: ["4", "8", "9", "10"], correctIndex: 1, explanation: "An antiderivative is x², so [x²]₁³=9−1=8.", arabicExplanation: "دالة أصلية هي x²، لذلك [x²]₁³=9−1=8.", patternSource: "Current Grade 12 question-bank integration patterns; original bounds" },
] as const;

const grade12LongQuestions = [
  ...grade12MiniMockExam.questions,
  grade12LongAdditionalQuestions[0],
  grade12LongAdditionalQuestions[1],
  grade12LongAdditionalQuestions[3],
  grade12LongAdditionalQuestions[4],
] as const;

const grade12GeneralSciencesAdditionalQuestions = [
  { id: "bank-g12gs-complex-product", grade: "Grade 12", branch: "General Sciences", skill: "Complex numbers", prompt: "If z=2−i, find |z|².", arabicPrompt: "إذا كان z=2−i، أوجد |z|².", options: ["√3", "3", "5", "6"], correctIndex: 2, explanation: "|z|²=2²+(−1)²=5. Therefore the correct option is 5.", arabicExplanation: "|z|²=2²+(−1)²=5. إذن الاختيار الصحيح هو 5.", patternSource: "Current Grade 12 General Sciences complex-number patterns; original values" },
  { id: "bank-g12gs-trig-equation", grade: "Grade 12", branch: "General Sciences", skill: "Trigonometry", prompt: "On [0, 2π], how many solutions does sin(x)=0 have?", arabicPrompt: "ضمن المجال [0، 2π]، كم حلًا للمعادلة sin(x)=0؟", options: ["1", "2", "3", "4"], correctIndex: 2, explanation: "The solutions are x=0, π, and 2π, so there are 3 solutions on the closed interval.", arabicExplanation: "الحلول هي x=0 وπ و2π، لذلك يوجد 3 حلول على المجال المغلق.", patternSource: "Current Grade 12 General Sciences trigonometry patterns; original interval" },
  { id: "bank-g12gs-vector-dot", grade: "Grade 12", branch: "General Sciences", skill: "Vectors", prompt: "For u=(2,1) and v=(3,−2), find u·v.", arabicPrompt: "إذا كان u=(2،1) وv=(3،−2)، أوجد u·v.", options: ["−4", "0", "4", "8"], correctIndex: 1, explanation: "u·v=2·3+1·(−2)=6−2=4. Therefore the correct option is 4.", arabicExplanation: "u·v=2·3+1·(−2)=6−2=4. إذن الاختيار الصحيح هو 4.", patternSource: "Current Grade 12 General Sciences vector patterns; original coordinates" },
  { id: "bank-g12gs-probability-binomial", grade: "Grade 12", branch: "General Sciences", skill: "Probability", prompt: "A fair coin is tossed twice. What is the probability of exactly one head?", arabicPrompt: "رُميت قطعة نقد عادلة مرتين. ما احتمال ظهور صورة واحدة بالضبط؟", options: ["1/4", "1/2", "3/4", "1"], correctIndex: 1, explanation: "The favorable outcomes are HT and TH: 2 out of 4, so the probability is 1/2.", arabicExplanation: "النواتج الملائمة هي HT وTH: ناتجان من أصل 4، لذلك الاحتمال هو 1/2.", patternSource: "Current Grade 12 General Sciences probability patterns; original experiment" },
] as const;

export type Grade12ExamSection = {
  id: string;
  title: string;
  arabicTitle: string;
  questionIds: readonly string[];
  durationSeconds: number;
};

const fullGrade12Section = (questions: readonly { id: string }[]): Grade12ExamSection[] => [{ id: "full-assessment", title: "Full assessment", arabicTitle: "الاختبار الكامل", questionIds: questions.map((question) => question.id), durationSeconds: 30 * 60 }];

const createGrade12Sections = (questions: readonly { id: string }[], specs: readonly { id: string; title: string; arabicTitle: string; count: number; durationSeconds: number }[]): Grade12ExamSection[] => {
  let offset = 0;
  return specs.map((spec) => {
    const questionIds = questions.slice(offset, offset + spec.count).map((question) => question.id);
    offset += spec.count;
    return { id: spec.id, title: spec.title, arabicTitle: spec.arabicTitle, questionIds, durationSeconds: spec.durationSeconds };
  });
};

const lifeSciencesSectionSpecs = [
  { id: "functions-limits", title: "Functions and limits", arabicTitle: "الدوال والنهايات", count: 2, durationSeconds: 8 * 60 },
  { id: "calculus", title: "Calculus", arabicTitle: "التفاضل والتكامل", count: 2, durationSeconds: 8 * 60 },
  { id: "probability", title: "Probability and modeling", arabicTitle: "الاحتمالات والنمذجة", count: 2, durationSeconds: 7 * 60 },
  { id: "applied-review", title: "Applied review", arabicTitle: "المراجعة التطبيقية", count: 2, durationSeconds: 7 * 60 },
] as const;

const generalSciencesSectionSpecs = [
  { id: "complex-trigonometry", title: "Complex numbers and trigonometry", arabicTitle: "الأعداد المركبة والمثلثات", count: 2, durationSeconds: 10 * 60 },
  { id: "vectors-probability", title: "Vectors and probability", arabicTitle: "المتجهات والاحتمالات", count: 2, durationSeconds: 10 * 60 },
  { id: "exam-review", title: "Exam review", arabicTitle: "مراجعة الامتحان", count: 2, durationSeconds: 10 * 60 },
] as const;

export const grade12LongMockExam = {
  id: "grade-12-certificate-long-mock-1",
  title: "Grade 12 Certificate · Diagnostic Mock Exam 01",
  arabicTitle: "الشهادة الثانوية للصف الثاني عشر · اختبار تشخيصي مطوّل 01",
  durationSeconds: 30 * 60,
  sourceNote: "Original academy diagnostic assessment built from the current bilingual question bank and original variants; not an official examination paper.",
  arabicSourceNote: "اختبار تشخيصي أصلي من الأكاديمية مبني على بنك الأسئلة الثنائي الحالي ونسخ أصلية؛ وليس ورقة امتحان رسمية.",
  questions: grade12LongQuestions,
  sections: fullGrade12Section(grade12LongQuestions),
} as const;

export type SkillDiagnostic = {
  skill: string;
  correct: number;
  total: number;
  percentage: number;
  status: "strength" | "developing" | "priority";
};

const grade12SociologyEconomicsAdditionalQuestions = [
  { id: "bank-g12se-percent-change", grade: "Grade 12", branch: "Sociology and Economics", skill: "Percentages", prompt: "A price rises from $80 to $92. What is the percentage increase?", arabicPrompt: "ارتفع سعر من 80 دولارًا إلى 92 دولارًا. ما نسبة الزيادة؟", options: ["12%", "15%", "18%", "20%"], correctIndex: 1, explanation: "The increase is 12, and 12/80×100=15%.", arabicExplanation: "الزيادة هي 12، وبالتالي 12/80×100=15٪.", patternSource: "Current Grade 12 Sociology and Economics percentage patterns; original values" },
  { id: "bank-g12se-linear-cost", grade: "Grade 12", branch: "Sociology and Economics", skill: "Linear models", prompt: "A taxi charges $4 plus $1.50 per kilometer. What is the cost of 8 km?", arabicPrompt: "تتقاضى سيارة أجرة 4 دولارات إضافة إلى 1.50 دولار لكل كيلومتر. ما كلفة 8 كيلومترات؟", options: ["$12", "$14", "$16", "$20"], correctIndex: 2, explanation: "Cost=4+1.5(8)=4+12=$16. Therefore the correct option is $16.", arabicExplanation: "الكلفة=4+1.5(8)=4+12=16 دولارًا. إذن الاختيار الصحيح هو 16 دولارًا.", patternSource: "Current Grade 12 Sociology and Economics function patterns; original context" },
  { id: "bank-g12se-mean-income", grade: "Grade 12", branch: "Sociology and Economics", skill: "Statistics", prompt: "The incomes of four workers are 20, 24, 26, and 30 (in thousands). What is their mean income?", arabicPrompt: "مداخيل أربعة عمال هي 20 و24 و26 و30 (بالآلاف). ما متوسط الدخل؟", options: ["24", "25", "26", "27"], correctIndex: 1, explanation: "Mean=(20+24+26+30)/4=100/4=25 thousand.", arabicExplanation: "المتوسط=(20+24+26+30)/4=100/4=25 ألفًا.", patternSource: "Current Grade 12 Sociology and Economics statistics patterns; original data" },
  { id: "bank-g12se-simple-interest", grade: "Grade 12", branch: "Sociology and Economics", skill: "Financial mathematics", prompt: "At simple interest, what interest is earned on $2,000 at 4% per year for 3 years?", arabicPrompt: "بالفائدة البسيطة، ما قيمة الفائدة على 2000 دولار بنسبة 4٪ سنويًا لمدة 3 سنوات؟", options: ["$80", "$160", "$240", "$2,240"], correctIndex: 2, explanation: "I=Prt=2000×0.04×3=$240.", arabicExplanation: "I=Prt=2000×0.04×3=240 دولارًا.", patternSource: "Current Grade 12 Sociology and Economics financial-mathematics patterns; original values" },
  { id: "bank-g12se-ratio-change", grade: "Grade 12", branch: "Sociology and Economics", skill: "Percentages", prompt: "A monthly expense rises from $400 to $450. What is the percentage increase?", arabicPrompt: "ارتفعت نفقة شهرية من 400 دولار إلى 450 دولارًا. ما نسبة الزيادة؟", options: ["5%", "10%", "12.5%", "20%"], correctIndex: 2, explanation: "The increase is 50, and 50/400×100=12.5%.", arabicExplanation: "الزيادة هي 50، وبالتالي 50/400×100=12.5٪.", patternSource: "Current Grade 12 Sociology and Economics percentage patterns; original values" },
  { id: "bank-g12se-compound-growth", grade: "Grade 12", branch: "Sociology and Economics", skill: "Exponential models", prompt: "An investment of $1,000 grows by 5% each year. What is its value after 2 years?", arabicPrompt: "ينمو استثمار قيمته 1000 دولار بنسبة 5٪ سنويًا. ما قيمته بعد سنتين؟", options: ["$1,050", "$1,100", "$1,102.50", "$1,150"], correctIndex: 2, explanation: "Value=1000(1.05)^2=$1,102.50.", arabicExplanation: "القيمة=1000(1.05)^2=1102.50 دولارًا.", patternSource: "Current Grade 12 Sociology and Economics exponential-model patterns; original values" },
  { id: "bank-g12se-marginal-cost", grade: "Grade 12", branch: "Sociology and Economics", skill: "Derivatives", prompt: "If C(x)=x²+4x+9 is a cost function, what is the marginal cost at x=3?", arabicPrompt: "إذا كانت C(x)=x²+4x+9 دالة كلفة، فما الكلفة الحدية عند x=3؟", options: ["6", "10", "13", "18"], correctIndex: 1, explanation: "C′(x)=2x+4, so C′(3)=10.", arabicExplanation: "C′(x)=2x+4، ولذلك C′(3)=10.", patternSource: "Current Grade 12 Sociology and Economics derivative patterns; original cost model" },
  { id: "bank-g12se-revenue-integral", grade: "Grade 12", branch: "Sociology and Economics", skill: "Integration", prompt: "A marginal revenue is R′(x)=10−0.5x. What revenue accumulates from x=0 to x=8?", arabicPrompt: "إذا كان الإيراد الحدي R′(x)=10−0.5x، فما الإيراد المتراكم من x=0 إلى x=8؟", options: ["48", "56", "64", "72"], correctIndex: 2, explanation: "∫₀⁸(10−0.5x)dx=[10x−0.25x²]₀⁸=80−16=64.", arabicExplanation: "∫₀⁸(10−0.5x)dx=[10x−0.25x²]₀⁸=80−16=64.", patternSource: "Current Grade 12 Sociology and Economics integration patterns; original revenue model" },
  { id: "bank-g12se-median-wages", grade: "Grade 12", branch: "Sociology and Economics", skill: "Statistics", prompt: "The ordered wages are 12, 15, 18, 20, and 25. What is the median?", arabicPrompt: "الأجور المرتبة هي 12 و15 و18 و20 و25. ما الوسيط؟", options: ["15", "16", "18", "20"], correctIndex: 2, explanation: "With five ordered values, the middle third value is the median: 18.", arabicExplanation: "عند وجود خمس قيم مرتبة، تكون القيمة الثالثة هي الوسيط: 18.", patternSource: "Current Grade 12 Sociology and Economics statistics patterns; original data" },
  { id: "bank-g12se-variance", grade: "Grade 12", branch: "Sociology and Economics", skill: "Statistics", prompt: "For the population data 2, 4, 4, 6, what is the variance?", arabicPrompt: "لبيانات المجتمع 2 و4 و4 و6، ما التباين؟", options: ["1", "2", "4", "8"], correctIndex: 1, explanation: "The mean is 4; squared deviations sum to 8, and 8/4=2.", arabicExplanation: "المتوسط هو 4؛ مجموع مربعات الانحرافات 8، و8/4=2.", patternSource: "Current Grade 12 Sociology and Economics variance patterns; original data" },
  { id: "bank-g12se-two-red", grade: "Grade 12", branch: "Sociology and Economics", skill: "Probability", prompt: "A box has 5 red and 3 blue cards. Without replacement, what is the probability of drawing two red cards?", arabicPrompt: "يحتوي صندوق على 5 بطاقات حمراء و3 زرقاء. دون إرجاع، ما احتمال سحب بطاقتين حمراوين؟", options: ["5/14", "3/8", "1/2", "5/8"], correctIndex: 0, explanation: "P=(5/8)(4/7)=20/56=5/14.", arabicExplanation: "P=(5/8)(4/7)=20/56=5/14.", patternSource: "Current Grade 12 Sociology and Economics probability patterns; original sampling" },
  { id: "bank-g12se-binomial", grade: "Grade 12", branch: "Sociology and Economics", skill: "Probability", prompt: "A success has probability 1/2 on each of 3 trials. What is the probability of exactly 2 successes?", arabicPrompt: "احتمال النجاح هو 1/2 في كل واحدة من 3 محاولات. ما احتمال نجاح محاولتين بالضبط؟", options: ["1/8", "3/8", "1/2", "3/4"], correctIndex: 1, explanation: "There are 3 arrangements, each with probability (1/2)^3, so P=3/8.", arabicExplanation: "هناك 3 ترتيبات، واحتمال كل منها (1/2)^3، لذلك P=3/8.", patternSource: "Current Grade 12 Sociology and Economics binomial patterns; original trials" },
  { id: "bank-g12se-equilibrium", grade: "Grade 12", branch: "Sociology and Economics", skill: "Linear models", prompt: "Demand is q=80−2p and supply is q=20+p. What is the equilibrium price?", arabicPrompt: "الطلب q=80−2p والعرض q=20+p. ما سعر التوازن؟", options: ["10", "20", "30", "40"], correctIndex: 1, explanation: "Set demand equal to supply: 80−2p=20+p, so 60=3p and p=20.", arabicExplanation: "نساوي الطلب بالعرض: 80−2p=20+p، فنحصل على 60=3p ومنه p=20.", patternSource: "Current Grade 12 Sociology and Economics equilibrium patterns; original market model" },
  { id: "bank-g12se-demand-decrease", grade: "Grade 12", branch: "Sociology and Economics", skill: "Percentages", prompt: "Demand falls from 500 units to 450 units. What is the percentage decrease?", arabicPrompt: "انخفض الطلب من 500 وحدة إلى 450 وحدة. ما نسبة الانخفاض؟", options: ["5%", "10%", "15%", "20%"], correctIndex: 1, explanation: "The decrease is 50, and 50/500×100=10%.", arabicExplanation: "الانخفاض هو 50، وبالتالي 50/500×100=10٪.", patternSource: "Current Grade 12 Sociology and Economics demand patterns; original values" },
  { id: "bank-g12se-arithmetic-term", grade: "Grade 12", branch: "Sociology and Economics", skill: "Sequences", prompt: "An arithmetic sequence starts 7, 10, 13, … What is its fifth term?", arabicPrompt: "متتالية حسابية تبدأ بـ7 و10 و13، … ما حدها الخامس؟", options: ["15", "16", "19", "22"], correctIndex: 2, explanation: "The common difference is 3, so u₅=7+4×3=19.", arabicExplanation: "الفرق المشترك هو 3، لذلك u₅=7+4×3=19.", patternSource: "Current Grade 12 Sociology and Economics sequence patterns; original values" },
  { id: "bank-g12se-break-even", grade: "Grade 12", branch: "Sociology and Economics", skill: "Quadratic models", prompt: "The break-even equation is x²−9x+20=0. What is the smaller break-even quantity?", arabicPrompt: "معادلة نقطة التعادل هي x²−9x+20=0. ما كمية التعادل الأصغر؟", options: ["2", "4", "5", "10"], correctIndex: 1, explanation: "x²−9x+20=(x−4)(x−5), so the smaller root is 4.", arabicExplanation: "x²−9x+20=(x−4)(x−5)، لذلك الجذر الأصغر هو 4.", patternSource: "Current Grade 12 Sociology and Economics quadratic patterns; original break-even model" },
  { id: "bank-g12se-depreciation", grade: "Grade 12", branch: "Sociology and Economics", skill: "Exponential models", prompt: "An asset worth $1,200 depreciates by 10% each year. What is its value after 2 years?", arabicPrompt: "تتناقص قيمة أصل ثمنه 1200 دولار بنسبة 10٪ كل سنة. ما قيمته بعد سنتين؟", options: ["$960", "$972", "$1,080", "$1,188"], correctIndex: 1, explanation: "Value=1200(0.9)^2=$972.", arabicExplanation: "القيمة=1200(0.9)^2=972 دولارًا.", patternSource: "Current Grade 12 Sociology and Economics exponential depreciation patterns; original values" },
  { id: "bank-g12se-z-score", grade: "Grade 12", branch: "Sociology and Economics", skill: "Statistics", prompt: "A dataset has mean 70 and standard deviation 10. What is the z-score of 85?", arabicPrompt: "لمجموعة بيانات متوسطها 70 وانحرافها المعياري 10، ما الدرجة المعيارية للقيمة 85؟", options: ["0.5", "1.5", "2", "8.5"], correctIndex: 1, explanation: "z=(85−70)/10=1.5.", arabicExplanation: "z=(85−70)/10=1.5.", patternSource: "Current Grade 12 Sociology and Economics standard-score patterns; original values" },
  { id: "bank-g12se-correlation-strength", grade: "Grade 12", branch: "Sociology and Economics", skill: "Correlation", prompt: "Which correlation coefficient represents the strongest negative linear relationship?", arabicPrompt: "أي معامل ارتباط يمثل أقوى علاقة خطية سلبية؟", options: ["−0.2", "0.1", "0.7", "−0.95"], correctIndex: 3, explanation: "The value closest to −1 represents the strongest negative linear relationship: −0.95.", arabicExplanation: "القيمة الأقرب إلى −1 تمثل أقوى علاقة خطية سلبية: −0.95.", patternSource: "Current Grade 12 Sociology and Economics correlation patterns; original values" },
  { id: "bank-g12se-present-value", grade: "Grade 12", branch: "Sociology and Economics", skill: "Financial mathematics", prompt: "What is the present value of $1,100 due in one year at a 10% discount rate?", arabicPrompt: "ما القيمة الحالية لمبلغ 1100 دولار مستحق بعد سنة، عند معدل خصم 10٪؟", options: ["$900", "$1,000", "$1,010", "$1,210"], correctIndex: 1, explanation: "Present value=1100/(1.10)=$1,000.", arabicExplanation: "القيمة الحالية=1100/1.10=1000 دولار.", patternSource: "Current Grade 12 Sociology and Economics financial-mathematics patterns; original values" },
] as const;

const grade12SociologyEconomicsQuestions = [...grade12MiniMockExam.questions.filter((question) => question.branch === "Sociology and Economics"), ...grade12SociologyEconomicsAdditionalQuestions] as const;

export const grade12SpecializationExams = {
  "Life Sciences": {
    ...grade12LongMockExam,
    id: "grade-12-life-sciences-diagnostic-1",
    title: "Grade 12 Life Sciences · Diagnostic Mock Exam 01",
    arabicTitle: "الشهادة الثانوية علوم الحياة · اختبار تشخيصي 01",
    questions: grade12LongMockExam.questions.filter((question) => question.branch === "Life Sciences"),
    sections: createGrade12Sections(grade12LongMockExam.questions.filter((question) => question.branch === "Life Sciences"), lifeSciencesSectionSpecs),
  },
  "General Sciences": {
    ...grade12LongMockExam,
    id: "grade-12-general-sciences-diagnostic-1",
    title: "Grade 12 General Sciences · Diagnostic Mock Exam 01",
    arabicTitle: "الشهادة الثانوية علوم عامة · اختبار تشخيصي 01",
    questions: [...grade12MiniMockExam.questions.filter((question) => question.branch === "General Sciences"), ...grade12GeneralSciencesAdditionalQuestions],
    sections: createGrade12Sections([...grade12MiniMockExam.questions.filter((question) => question.branch === "General Sciences"), ...grade12GeneralSciencesAdditionalQuestions], generalSciencesSectionSpecs),
  },
  "Sociology and Economics": {
    ...grade12LongMockExam,
    id: "grade-12-sociology-economics-diagnostic-1",
    title: "Grade 12 Sociology and Economics · Diagnostic Mock Exam 01",
    arabicTitle: "الشهادة الثانوية فرع الاجتماع والاقتصاد · اختبار تشخيصي 01",
    questions: grade12SociologyEconomicsQuestions,
    sections: [
      { id: "market-models", title: "Markets and models", arabicTitle: "الأسواق والنماذج", questionIds: grade12SociologyEconomicsQuestions.slice(0, 5).map((question) => question.id), durationSeconds: 8 * 60 },
      { id: "statistics-probability", title: "Statistics and probability", arabicTitle: "الإحصاء والاحتمالات", questionIds: grade12SociologyEconomicsQuestions.slice(5, 10).map((question) => question.id), durationSeconds: 8 * 60 },
      { id: "calculus-finance", title: "Calculus and finance", arabicTitle: "التفاضل والتكامل والماليات", questionIds: grade12SociologyEconomicsQuestions.slice(10, 15).map((question) => question.id), durationSeconds: 7 * 60 },
      { id: "applied-review", title: "Applied review", arabicTitle: "المراجعة التطبيقية", questionIds: grade12SociologyEconomicsQuestions.slice(15, 20).map((question) => question.id), durationSeconds: 7 * 60 },
    ],
  },
} as const;

export type Grade12Specialization = keyof typeof grade12SpecializationExams;

export function calculateGrade12DiagnosticReport(exam: { questions: readonly { id: string; skill: string; correctIndex: number }[] }, answers: Record<string, number>) {
  const correct = exam.questions.reduce((total, question) => total + (answers[question.id] === question.correctIndex ? 1 : 0), 0);
  const answered = exam.questions.filter((question) => answers[question.id] !== undefined).length;
  const total = exam.questions.length;
  const skills = Array.from(new Set(exam.questions.map((question) => question.skill))).map((skill): SkillDiagnostic => {
    const questions = exam.questions.filter((question) => question.skill === skill);
    const skillCorrect = questions.reduce((sum, question) => sum + (answers[question.id] === question.correctIndex ? 1 : 0), 0);
    const percentage = Math.round((skillCorrect / questions.length) * 100);
    return { skill, correct: skillCorrect, total: questions.length, percentage, status: percentage >= 75 ? "strength" : percentage >= 50 ? "developing" : "priority" };
  }).sort((a, b) => a.percentage - b.percentage || a.skill.localeCompare(b.skill));
  const weakest = skills[0];
  const strongest = [...skills].sort((a, b) => b.percentage - a.percentage)[0];
  return { correct, answered, total, percentage: total ? Math.round((correct / total) * 100) : 0, skills, weakestSkill: weakest?.skill ?? null, strongestSkill: strongest?.skill ?? null };
}

export function calculateGrade12LongMockExamReport(answers: Record<string, number>) {
  return calculateGrade12DiagnosticReport(grade12LongMockExam, answers);
}
