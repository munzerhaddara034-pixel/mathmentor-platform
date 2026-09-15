import { grade9MockExam } from "./mockExam";
import { filterBankQuestions } from "./uploadedExamQuestionBank";

export type ExamModelQuestion = {
  id: string;
  skill: string;
  prompt: string;
  arabicPrompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  arabicExplanation: string;
};

export type ExamModel = {
  id: string;
  track: string;
  grade: "Grade 9" | "Grade 12" | "SAT";
  branch: "Middle School" | "Life Sciences" | "General Sciences" | "Sociology and Economics" | "SAT Math";
  difficulty: "Foundation" | "Certificate" | "Advanced";
  title: string;
  arabicTitle: string;
  durationMinutes: number;
  sections: readonly { title: string; arabicTitle: string; questionCount: number }[];
  questions: readonly ExamModelQuestion[];
  startPath: string;
  sourceNote: string;
};

const q = (id: string, skill: string, prompt: string, arabicPrompt: string, options: string[], correctIndex: number, explanation: string, arabicExplanation: string): ExamModelQuestion => ({ id, skill, prompt, arabicPrompt, options, correctIndex, explanation, arabicExplanation });

const generalOriginals = [
  q("model-gs-derivative", "Derivatives", "If f(x)=x²+3x, find f′(2).", "إذا كانت f(x)=x²+3x، أوجد f′(2).", ["5", "7", "9", "11"], 1, "f′(x)=2x+3, so f′(2)=7.", "f′(x)=2x+3، لذلك f′(2)=7."),
  q("model-gs-vector", "Vectors", "For u=(1,2) and v=(4,−1), find u·v.", "إذا كان u=(1،2) وv=(4،−1)، أوجد u·v.", ["−2", "0", "2", "6"], 2, "u·v=1·4+2·(−1)=2.", "u·v=1·4+2·(−1)=2."),
  q("model-gs-complex", "Complex numbers", "Find |3−4i|.", "أوجد معيار العدد المركب 3−4i.", ["3", "4", "5", "7"], 2, "|z|=√(3²+4²)=5.", "|z|=√(3²+4²)=5."),
  q("model-gs-probability", "Probability", "A fair die is rolled. What is P(result>4)?", "رُمي حجر نرد عادل. ما احتمال أن تكون النتيجة أكبر من 4؟", ["1/6", "1/3", "1/2", "2/3"], 1, "The favorable results are 5 and 6: 2/6=1/3.", "الناتجان الملائمان هما 5 و6: ‏2/6=1/3."),
];

const economicsOriginals = [
  q("model-se-interest", "Financial mathematics", "A $500 deposit earns 6% simple interest for 2 years. Find the interest.", "إيداع قيمته 500 دولار بفائدة بسيطة 6٪ لمدة سنتين. أوجد قيمة الفائدة.", ["$30", "$60", "$530", "$560"], 1, "I=Prt=500×0.06×2=$60.", "الفائدة I=Prt=500×0.06×2=60 دولارًا."),
  q("model-se-break-even", "Break-even models", "Fixed cost is 240 and unit contribution is 12. How many units reach break-even?", "الكلفة الثابتة 240 وهامش المساهمة للوحدة 12. كم وحدة تحقق نقطة التعادل؟", ["12", "20", "28", "252"], 1, "Break-even quantity=240/12=20 units.", "عدد وحدات التعادل=240/12=20 وحدة."),
  q("model-se-mean", "Statistics", "Find the mean of 12, 15, 15, and 18.", "أوجد المتوسط الحسابي للأعداد 12 و15 و15 و18.", ["14", "15", "16", "60"], 1, "The sum is 60 and 60/4=15.", "المجموع 60، و60/4=15."),
  q("model-se-growth", "Percent change", "A quantity falls from 250 to 200. What is the percentage decrease?", "انخفضت كمية من 250 إلى 200. ما نسبة الانخفاض؟", ["20%", "25%", "50%", "80%"], 0, "The decrease is 50; 50/250=20%.", "الانخفاض 50، والنسبة 50/250=20٪."),
];

const satOriginals = [
  q("model-sat-linear", "Linear equations", "If 3x+5=20, what is x?", "إذا كان 3x+5=20، فما قيمة x؟", ["3", "5", "7", "15"], 1, "Subtract 5 and divide by 3: x=5.", "نطرح 5 ثم نقسم على 3: x=5."),
  q("model-sat-quadratic", "Quadratics", "What is the positive solution of x²−9=0?", "ما الحل الموجب للمعادلة x²−9=0؟", ["−9", "−3", "3", "9"], 2, "x²=9, so the positive solution is 3.", "x²=9، لذلك الحل الموجب هو 3."),
  q("model-sat-rate", "Rates", "A car travels 180 miles in 3 hours. What is its average speed?", "قطعت سيارة 180 ميلًا في 3 ساعات. ما سرعتها المتوسطة؟", ["30", "45", "60", "90"], 2, "Average speed=180/3=60 miles per hour.", "السرعة المتوسطة=180/3=60 ميلًا في الساعة."),
  q("model-sat-data", "Data analysis", "The mean of 4, 7, 9, and x is 8. What is x?", "المتوسط الحسابي للأعداد 4 و7 و9 وx هو 8. أوجد x.", ["0", "4", "8", "12"], 3, "The total must be 4×8=32. Since 4+7+9=20, x=12.", "المجموع المطلوب هو 4×8=32. وبما أن 4+7+9=20، فإن x=12."),
  q("model-sat-exponential", "Exponential models", "A population doubles every 5 years. Starting at 800, what is it after 5 years?", "يتضاعف عدد السكان كل 5 سنوات. إذا بدأ بـ800، كم يصبح بعد 5 سنوات؟", ["805", "1,200", "1,600", "4,000"], 2, "One doubling gives 800×2=1,600.", "بعد تضاعف واحد يصبح العدد 800×2=1600."),
  q("model-sat-geometry", "Geometry", "A circle has radius 4. What is its area in terms of π?", "دائرة نصف قطرها 4. ما مساحتها بدلالة π؟", ["4π", "8π", "16π", "32π"], 2, "Area=πr²=16π.", "المساحة=πr²=16π."),
];

const fromBank = (track: "Life Sciences" | "General Sciences" | "Sociology and Economics", count: number): ExamModelQuestion[] => filterBankQuestions("Grade 12", track).slice(0, count).map((item) => ({ id: `model-${track.toLowerCase().replaceAll(" ", "-")}-${item.id}`, skill: item.skill, prompt: item.prompt, arabicPrompt: item.arabicPrompt, options: item.options, correctIndex: item.correctIndex, explanation: item.explanation, arabicExplanation: item.arabicExplanation }));

const grade9Questions = grade9MockExam.questions.slice(0, 6).map((item, index) => ({ ...item, id: `model-grade9-${index + 1}` }));
const lifeQuestions = fromBank("Life Sciences", 6);
const generalQuestions = [...fromBank("General Sciences", 2), ...generalOriginals];
const economicsQuestions = [...fromBank("Sociology and Economics", 2), ...economicsOriginals];

export const examModels: readonly ExamModel[] = [
  { id: "grade-9-certificate-model-1", track: "Grade 9", grade: "Grade 9", branch: "Middle School", difficulty: "Foundation", title: "Grade 9 Certificate · Model Exam 01", arabicTitle: "الشهادة المتوسطة · نموذج امتحان 01", durationMinutes: 30, sections: [{ title: "Core skills", arabicTitle: "المهارات الأساسية", questionCount: 3 }, { title: "Applied practice", arabicTitle: "التطبيق والتدريب", questionCount: 3 }], questions: grade9Questions, startPath: "/exam-models/grade-9-certificate-model-1", sourceNote: "Original academy model inspired by recurring skill patterns, not copied from any source paper." },
  { id: "grade-12-life-sciences-model-1", track: "Life Sciences", grade: "Grade 12", branch: "Life Sciences", difficulty: "Certificate", title: "Grade 12 Life Sciences · Model Exam 01", arabicTitle: "الشهادة الثانوية علوم الحياة · نموذج 01", durationMinutes: 30, sections: [{ title: "Functions and calculus", arabicTitle: "الدوال والتفاضل والتكامل", questionCount: 3 }, { title: "Probability and modeling", arabicTitle: "الاحتمالات والنمذجة", questionCount: 3 }], questions: lifeQuestions, startPath: "/exam-models/grade-12-life-sciences-model-1", sourceNote: "Original bilingual variants based on skill categories from the attached reference set." },
  { id: "grade-12-general-sciences-model-1", track: "General Sciences", grade: "Grade 12", branch: "General Sciences", difficulty: "Certificate", title: "Grade 12 General Sciences · Model Exam 01", arabicTitle: "الشهادة الثانوية علوم عامة · نموذج 01", durationMinutes: 30, sections: [{ title: "Analysis and algebra", arabicTitle: "التحليل والجبر", questionCount: 3 }, { title: "Complex numbers and probability", arabicTitle: "الأعداد المركبة والاحتمالات", questionCount: 3 }], questions: generalQuestions, startPath: "/exam-models/grade-12-general-sciences-model-1", sourceNote: "Original questions with new values and contexts; not an official paper." },
  { id: "grade-12-sociology-economics-model-1", track: "Sociology and Economics", grade: "Grade 12", branch: "Sociology and Economics", difficulty: "Certificate", title: "Grade 12 Sociology and Economics · Model Exam 01", arabicTitle: "الشهادة الثانوية اقتصاد واجتماعيات · نموذج 01", durationMinutes: 30, sections: [{ title: "Applied economics", arabicTitle: "الاقتصاد التطبيقي", questionCount: 3 }, { title: "Statistics and finance", arabicTitle: "الإحصاء والرياضيات المالية", questionCount: 3 }], questions: economicsQuestions, startPath: "/exam-models/grade-12-sociology-economics-model-1", sourceNote: "Original branch-appropriate questions derived from skills, not copied wording." },
  { id: "sat-math-model-1", track: "SAT Math", grade: "SAT", branch: "SAT Math", difficulty: "Advanced", title: "SAT Math · Model Exam 01", arabicTitle: "رياضيات SAT · نموذج 01", durationMinutes: 35, sections: [{ title: "Heart of Algebra", arabicTitle: "أساسيات الجبر", questionCount: 3 }, { title: "Problem Solving and Data", arabicTitle: "حل المسائل والبيانات", questionCount: 3 }], questions: satOriginals, startPath: "/exam-models/sat-math-model-1", sourceNote: "Original SAT-style practice questions; not official College Board material." },
];

export function getExamModel(id: string) { return examModels.find((model) => model.id === id); }
