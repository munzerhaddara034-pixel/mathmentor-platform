import { assembleSolution } from "./assemble";
import type { MathSolution } from "./types";
import type { LessonLanguage } from "@/lib/studio/timeline";

export const RETAKE_EN =
  "The photo or text is unclear or incomplete. Please rephotograph the notebook (full question, good light, no crop) or type the given in LaTeX. I will not invent a problem.";
export const RETAKE_AR =
  "الصورة أو النص غير واضح أو ناقص. صوّر الدفتر من جديد (السؤال كاملاً، إضاءة جيدة، بلا قص) أو اكتب المعطيات باللاتكس. لن أخترع مسألة.";

export function looksLikeMath(text: string) {
  const n = text.replace(/[−–—]/g, "-").trim();
  if (n.length < 2) return false;
  return /[0-9=x∫√∞π\\^_{}()+\-*/]|معادل|نهاي|اشتق|جذر|مثلث|sin|cos|tan|ln|log|e\^|dx|حد|حلّ|أوجد|find|solve|derive|limit|integral|complex|quad|system|triangle|hypoten|percent|z\s*=|f\s*\(|f'/i.test(
    n,
  );
}

export function isGarbledPrompt(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (looksLikeMath(trimmed)) return false;
  return true;
}

export function retakeSolution(input: {
  question: string;
  language?: LessonLanguage;
  imageName?: string;
  source?: MathSolution["source"];
}): MathSolution {
  const question = input.question || (input.imageName ? `(unclear photo) ${input.imageName}` : "(unclear)");
  const assembled = assembleSolution({
    question,
    summary: RETAKE_EN,
    finalAnswer: "—",
    finalAnswerLatex: "\\text{rephotograph}",
    steps: [
      {
        title: "Cannot read the paper",
        titleAr: "لا يمكن قراءة الورقة",
        titleFr: "Copie illisible",
        latex: "\\text{needs a clear photo}",
        theoremEn: "Hallucination guard",
        theoremAr: "منع الاختراع",
        explanationEn: RETAKE_EN,
        explanationFr: "Photo ou texte illisible — on ne fabrique pas un énoncé.",
        explanationAr: RETAKE_AR,
      },
      {
        title: "What to capture",
        titleAr: "ماذا تصوّر",
        latex: "\\text{full given + asked}",
        theoremEn: "Official-paper completeness",
        theoremAr: "اكتمال الورقة الرسمية",
        explanationEn: "Include the given, the asked quantity, and any figure labels. Crop only empty margins.",
        explanationFr: "Inclure les données, la question, et les labels.",
        explanationAr: "أظهر المعطيات والمطلوب وأي رسم مع التسميات.",
      },
      {
        title: "Then send again",
        titleAr: "أعد الإرسال",
        latex: "\\text{retry}",
        theoremEn: "Retry",
        theoremAr: "إعادة",
        explanationEn: "Type the given in LaTeX if the ink is faint. Prof. Munzer Haddara will then write a full barème.",
        explanationFr: "Saisir le LaTeX si l’encre est pâle.",
        explanationAr: "اكتب المعطيات لاتكساً إذا كان الحبر باهتاً.",
      },
    ],
    topic: "Unclear input",
    topicTag: "unclear",
    language: input.language,
    source: input.source ?? "demo",
    given: {
      latex: "\\text{illegible}",
      aimEn: "Need a complete, readable question.",
      aimAr: "يلزم سؤال كامل وواضح.",
      aimFr: "Il faut un énoncé lisible et complet.",
    },
  });
  assembled.needsRetake = true;
  assembled.retakeMessageEn = RETAKE_EN;
  assembled.retakeMessageAr = RETAKE_AR;
  assembled.warning = RETAKE_EN;
  return assembled;
}
