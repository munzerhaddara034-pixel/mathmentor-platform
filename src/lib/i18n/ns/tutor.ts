import type { Locale } from "../config";
import type { Widen } from "../widen";

/** PedagogicalTutorPanel chrome (the tutor's own answer stays in the explanation language the student picks). */
const en = {
  title: "Learn the solution step by step",
  curriculumLine: "{curriculum} curriculum · {derivative} · {limits}",
  modesHelp: "Direct: a full solution with justification. Socratic: graded hints so you reach the solution yourself; the final answer only shows if you ask for it.",
  problem: "Problem",
  problemPh: "Type the problem here",
  latexLabel: "{latex} form (optional)",
  mode: "Style",
  direct: "Direct",
  socratic: "Socratic (hints)",
  explanationLanguage: "Explanation language",
  revealAnswer: "Reveal the final answer",
  unlock: "Unlock the AI solver",
  preparing: "Preparing…",
  retrying: "Retrying…",
  ask: "Ask the AI tutor",
  objective: "Objective:",
  prerequisite: "Prerequisite:",
  demoNotice: "The server is under temporary load, so an approximate practice model is shown. Try again in a moment for a full AI solution.",
  hints: "Hints",
  finalAnswer: "Final answer",
  errors: {
    network: "Network error. Please retry.",
    timeout: "The request timed out. Please retry.",
    busy: "The server is busy. Please retry.",
    failed: "The tutor request failed.",
    tier: "An AI subscription is required. Redeem a code on /redeem.",
  },
} as const;

export type TutorMessages = Widen<typeof en>;

const ar: TutorMessages = {
  title: "تعلّم الحل خطوة بخطوة",
  curriculumLine: "منهج {curriculum} · {derivative} · {limits}",
  modesHelp: "«مباشر»: حل كامل مع التبرير. «سقراطي»: تلميحات متدرّجة لتصل إلى الحل بنفسك، ولا يظهر الجواب النهائي إلا إذا طلبته.",
  problem: "المسألة",
  problemPh: "اكتب المسألة هنا",
  latexLabel: "صيغة {latex} (اختياري)",
  mode: "الأسلوب",
  direct: "مباشر",
  socratic: "سقراطي (تلميحات)",
  explanationLanguage: "لغة الشرح",
  revealAnswer: "اكشف الجواب النهائي",
  unlock: "فعّل اشتراك الحلّال",
  preparing: "جارٍ التحضير…",
  retrying: "إعادة المحاولة…",
  ask: "اسأل المعلّم الذكي",
  objective: "الهدف:",
  prerequisite: "المتطلّب السابق:",
  demoNotice: "السيرفر تحت ضغط مؤقت، ويتم توليد نموذج تقريبي للتدريب. أعد المحاولة بعد لحظات للحصول على حل الذكاء الكامل.",
  hints: "تلميحات",
  finalAnswer: "الجواب النهائي",
  errors: {
    network: "خطأ في الشبكة. أعد المحاولة.",
    timeout: "انتهت مهلة الطلب. أعد المحاولة.",
    busy: "الخادم مشغول. أعد المحاولة.",
    failed: "تعذّر طلب المعلّم.",
    tier: "يلزم اشتراك الذكاء. فعّل كوداً على /redeem.",
  },
};

const fr: TutorMessages = {
  title: "Apprendre la solution pas à pas",
  curriculumLine: "Programme {curriculum} · {derivative} · {limits}",
  modesHelp: "Direct : une solution complète et justifiée. Socratique : des indices progressifs pour trouver la solution vous-même ; la réponse finale n’apparaît que si vous la demandez.",
  problem: "Énoncé",
  problemPh: "Saisissez l’énoncé ici",
  latexLabel: "Forme {latex} (facultatif)",
  mode: "Style",
  direct: "Direct",
  socratic: "Socratique (indices)",
  explanationLanguage: "Langue de l’explication",
  revealAnswer: "Afficher la réponse finale",
  unlock: "Débloquer le solveur IA",
  preparing: "Préparation…",
  retrying: "Nouvelle tentative…",
  ask: "Demander au tuteur IA",
  objective: "Objectif :",
  prerequisite: "Prérequis :",
  demoNotice: "Le serveur est momentanément chargé : un modèle d’entraînement approximatif est affiché. Réessayez dans un instant pour une solution IA complète.",
  hints: "Indices",
  finalAnswer: "Réponse finale",
  errors: {
    network: "Erreur réseau. Veuillez réessayer.",
    timeout: "La requête a expiré. Veuillez réessayer.",
    busy: "Le serveur est occupé. Veuillez réessayer.",
    failed: "La requête au tuteur a échoué.",
    tier: "Un abonnement IA est requis. Activez un code sur /redeem.",
  },
};

export const tutorMessages: Record<Locale, TutorMessages> = { en, ar, fr };
