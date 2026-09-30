import type { Locale } from "../config";
import type { Widen } from "../widen";

/** /classroom index, /classroom/[id] locked + not-found states, /resources (chrome). Lesson copy is content. */
const en = {
  index: {
    eyebrow: "Classroom studio",
    title: "Every grade. Every chapter. Professor at the board.",
    lead: "Open the lesson, then the quiz. The next chapter unlocks at 70%. Bilingual videos switch voice and board together with one EN | FR click.",
    player: "Explainer lessons & smart board",
    script: "Script generator",
    watch: "Watch now",
    watchLead: "Professor Munzer on camera. English by default, with a French toggle on the new explainers.",
    video: "Video",
    progress: "Track progress: {n}%",
    chapter: "Chapter {n}",
    locked: "Locked",
    lockedHint: "Pass the previous chapter's quiz first",
    loadFailed: "Could not load your progress — lessons show as locked until it loads.",
  },
  lesson: {
    notFound: "Lesson not found.",
    back: "Back to classroom",
    lockedTitle: "This lesson is locked",
    lockedLead: "Pass the previous lesson's quiz with at least {n}% to open it.",
    backIndex: "Back to the index",
    defaultName: "Academy student",
    chapterTitle: "Chapter {n} · {title}",
    functionsContest: "Functions contest",
  },
  resources: {
    eyebrow: "Attachments and summaries",
    title: "Handouts and printable worksheets",
    lead: "Protected, watermarked view. Direct file download is not available; open the page to view, or print — the text carries your name.",
    open: "Protected view",
  },
} as const;

export type ClassroomMessages = Widen<typeof en>;

const ar: ClassroomMessages = {
  index: {
    eyebrow: "استوديو الصف",
    title: "كل صف. كل فصل. الأستاذ على السبورة.",
    lead: "افتح الدرس ثم الاختبار. الفصل التالي يُفتح بعد 70%. الفيديوهات ثنائية اللغة تبدّل الصوت والسبورة معاً بنقرة EN | FR.",
    player: "مشغل الدروس الشارحة والسبورة الذكية",
    script: "مولّد السكربت",
    watch: "شاهد الآن",
    watchLead: "الأستاذ منذر أمام الكاميرا. الإنجليزية افتراضياً مع زر للفرنسية في الشروحات الجديدة.",
    video: "فيديو",
    progress: "إنجاز المادة: {n}%",
    chapter: "الفصل {n}",
    locked: "مقفل",
    lockedHint: "اجتز اختبار الفصل السابق أولاً",
    loadFailed: "تعذّر تحميل تقدّمك — تظهر الدروس مقفلة حتى يكتمل التحميل.",
  },
  lesson: {
    notFound: "الدرس غير موجود.",
    back: "العودة إلى الصف",
    lockedTitle: "الدرس مقفل",
    lockedLead: "يجب اجتياز اختبار الدرس السابق بنسبة {n}% على الأقل.",
    backIndex: "العودة للفهرس",
    defaultName: "طالب الأكاديمية",
    chapterTitle: "الفصل {n} · {title}",
    functionsContest: "مسابقة الدوال",
  },
  resources: {
    eyebrow: "المرفقات والملخصات",
    title: "دوسيات وأوراق عمل للطباعة",
    lead: "عرض محمي بعلامة مائية. التحميل المباشر للملف غير متاح؛ افتح الصفحة للعرض أو اطبع والنص يحمل اسمك.",
    open: "عرض محمي",
  },
};

const fr: ClassroomMessages = {
  index: {
    eyebrow: "Studio de classe",
    title: "Chaque classe. Chaque chapitre. Le professeur au tableau.",
    lead: "Ouvrez la leçon, puis le quiz. Le chapitre suivant se débloque à 70 %. Les vidéos bilingues basculent voix et tableau ensemble d'un clic EN | FR.",
    player: "Leçons expliquées et tableau intelligent",
    script: "Générateur de script",
    watch: "À regarder",
    watchLead: "Le Professeur Munzer face caméra. Anglais par défaut, avec bascule en français sur les nouvelles explications.",
    video: "Vidéo",
    progress: "Progression : {n} %",
    chapter: "Chapitre {n}",
    locked: "Verrouillé",
    lockedHint: "Réussissez d'abord le quiz du chapitre précédent",
    loadFailed: "Impossible de charger votre progression — les leçons restent verrouillées jusqu'au chargement.",
  },
  lesson: {
    notFound: "Leçon introuvable.",
    back: "Retour à la classe",
    lockedTitle: "Cette leçon est verrouillée",
    lockedLead: "Réussissez le quiz de la leçon précédente avec au moins {n} % pour l'ouvrir.",
    backIndex: "Retour au sommaire",
    defaultName: "Élève de l'académie",
    chapterTitle: "Chapitre {n} · {title}",
    functionsContest: "Concours sur les fonctions",
  },
  resources: {
    eyebrow: "Pièces jointes et résumés",
    title: "Polycopiés et fiches d'exercices à imprimer",
    lead: "Affichage protégé avec filigrane. Le téléchargement direct n'est pas disponible ; ouvrez la page pour consulter, ou imprimez — le texte porte votre nom.",
    open: "Affichage protégé",
  },
};

export const classroomMessages: Record<Locale, ClassroomMessages> = { en, ar, fr };
