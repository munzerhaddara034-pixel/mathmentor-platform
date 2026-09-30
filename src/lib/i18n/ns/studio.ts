import type { Locale } from "../config";
import type { Widen } from "../widen";

/** Staff studio chrome that lives outside the player's STUDIO_UI table (quality checklist). */
const en = {
  checklist: {
    eyebrow: "Teacher quality checklist",
    title: "Before you record or publish",
    lead: "Professor Munzer — a lesson ships only if a Terminale student could sit an official paper from this board.",
    items: [
      {
        title: "Official sequence",
        body: "Key Idea first, then D_f, then limits with asymptote equations (x=a, y=b, y=ax+b), then f' and the table of variations, then C_f. Not a slogan.",
      },
      {
        title: "Exam alignment",
        body: "LS / GS / SE (or Brevet) wording in EN+FR: Show that / Montrer que, Deduce / En déduire, Calculate / Calculer, IVT / Théorème des valeurs intermédiaires.",
      },
      {
        title: "Step completeness",
        body: "Every algebra line is on the board with a named theorem. Continuity + monotonicity before IVT. A paying student can copy it into the booklet.",
      },
      {
        title: "Graph + variation table",
        body: "Canvas triggers: renderMath, plotFunction, variationTable, boxAnswer. Roots, extrema, asymptotes timed. Pan/zoom must not pause the video.",
      },
      {
        title: "Trap + boxed answers",
        body: "Name the shortcuts that lose barème marks, then the correction. Each sub-question ends with a Boxed Final Answer.",
      },
      {
        title: "Monetization ready",
        body: "English default and French of equal quality. Instructor: Professor Munzer; Arabic brand always «منذر حداره».",
      },
    ],
  },
} as const;

export type StudioMessages = Widen<typeof en>;

const ar: StudioMessages = {
  checklist: {
    eyebrow: "قائمة جودة الأستاذ",
    title: "قبل التسجيل أو النشر",
    lead: "أستاذ منذر — لا يُنشر درس إلا إذا استطاع طالب الصف الثالث الثانوي أن يقدّم امتحاناً رسمياً انطلاقاً من هذه السبورة.",
    items: [
      {
        title: "التسلسل الرسمي",
        body: "الفكرة الأساسية أولاً، ثم D_f، ثم النهايات مع معادلات المقاربات (x=a، y=b، y=ax+b)، ثم f' وجدول التغيّرات، ثم C_f. ليس شعاراً.",
      },
      {
        title: "مواءمة الامتحان الرسمي",
        body: "صياغة LS / GS / SE (أو البريفيه) بالإنكليزية والفرنسية: Show that / Montrer que، Deduce / En déduire، Calculate / Calculer، IVT / مبرهنة القيم الوسطية.",
      },
      {
        title: "اكتمال الخطوات",
        body: "كل سطر جبري على السبورة مع اسم المبرهنة. الاستمرارية والرتابة قبل مبرهنة القيم الوسطية. يستطيع الطالب المشترك نسخه في دفتره.",
      },
      {
        title: "الرسم وجدول التغيّرات",
        body: "محفّزات السبورة: renderMath، plotFunction، variationTable، boxAnswer. الجذور والقيم القصوى والمقاربات موقّتة. التحريك والتكبير لا يوقفان الفيديو.",
      },
      {
        title: "الخطأ الشائع والإجابات المؤطّرة",
        body: "سمِّ الاختصارات التي تُفقد علامات السلّم، ثم التصحيح. كل سؤال فرعي ينتهي بجواب نهائي مؤطّر.",
      },
      {
        title: "جاهز للبيع",
        body: "الإنكليزية افتراضياً والفرنسية بالجودة نفسها. الأستاذ: أستاذ منذر؛ الاسم بالعربية دائماً «منذر حداره».",
      },
    ],
  },
};

const fr: StudioMessages = {
  checklist: {
    eyebrow: "Grille qualité enseignant",
    title: "Avant d’enregistrer ou de publier",
    lead: "Professeur Munzer — une leçon n’est publiée que si un élève de Terminale peut passer une épreuve officielle à partir de ce tableau.",
    items: [
      {
        title: "Séquence officielle",
        body: "D’abord l’idée clé, puis D_f, puis les limites avec les équations d’asymptotes (x=a, y=b, y=ax+b), puis f' et le tableau de variation, puis C_f. Pas un slogan.",
      },
      {
        title: "Alignement sur l’examen",
        body: "Formulations LS / GS / SE (ou Brevet) en EN+FR : Show that / Montrer que, Deduce / En déduire, Calculate / Calculer, IVT / Théorème des valeurs intermédiaires.",
      },
      {
        title: "Étapes complètes",
        body: "Chaque ligne de calcul est au tableau avec un théorème nommé. Continuité + monotonie avant le TVI. Un élève abonné peut la recopier dans son cahier.",
      },
      {
        title: "Graphe + tableau de variation",
        body: "Déclencheurs du tableau : renderMath, plotFunction, variationTable, boxAnswer. Racines, extrema, asymptotes minutés. Le zoom/déplacement ne doit pas mettre la vidéo en pause.",
      },
      {
        title: "Piège + réponses encadrées",
        body: "Nommer les raccourcis qui coûtent des points au barème, puis la correction. Chaque sous-question se termine par une réponse encadrée.",
      },
      {
        title: "Prêt à la vente",
        body: "Anglais par défaut et français de même qualité. Enseignant : Professeur Munzer ; nom arabe toujours «منذر حداره».",
      },
    ],
  },
};

export const studioMessages: Record<Locale, StudioMessages> = { en, ar, fr };
