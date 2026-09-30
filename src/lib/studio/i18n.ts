export type LessonLocale = "en" | "fr";
export type LessonLanguage = "en" | "fr" | "ar";

export type Bilingual = {
  en: string;
  fr?: string;
  ar?: string;
};

export function L(en: string, fr: string, ar?: string): Bilingual {
  return ar ? { en, fr, ar } : { en, fr };
}

export function toLessonLocale(language: string | undefined): LessonLocale {
  return language === "fr" ? "fr" : "en";
}

export function pickText(value: Bilingual | undefined, language: LessonLanguage | LessonLocale): string {
  if (!value) return "";
  if (language === "fr") return value.fr || value.en;
  if (language === "ar") return value.ar || value.en || value.fr || "";
  return value.en || value.fr || value.ar || "";
}

export function coerceBilingual(value: unknown): Bilingual | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { en: text, fr: text } : undefined;
  }
  if (typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const en = String(record.en ?? record.step_en ?? "");
  const fr = String(record.fr ?? record.step_fr ?? "");
  const ar = typeof record.ar === "string" ? record.ar : undefined;
  if (!en && !fr && !ar) return undefined;
  return {
    en: en || fr || ar || "",
    fr: fr || en || ar || "",
    ar,
  };
}

export const STUDIO_UI = {
  eyebrow: { en: "Interactive video & explanation studio", fr: "Studio vidéo interactif et explications", ar: "درس تفاعلي: فيديو وسبورة" },
  canvas: { en: "Dynamic math canvas", fr: "Tableau mathématique dynamique", ar: "السبورة الرياضية" },
  canvasSub: { en: "Graphs · equations · variation table", fr: "Graphes · équations · tableau de variation", ar: "رسوم بيانية · معادلات · جدول تغيّرات" },
  waiting: { en: "Waiting for the lesson clock…", fr: "En attente du début de la leçon…", ar: "تبدأ السبورة مع تشغيل الدرس…" },
  avatar: { en: "Interactive video / AI avatar", fr: "Vidéo interactive / avatar IA", ar: "فيديو الأستاذ" },
  freeze: { en: "Look at the board", fr: "Regardez le tableau", ar: "انظر إلى السبورة" },
  speaking: { en: "speaking", fr: "en train d’expliquer", ar: "يشرح الآن" },
  paused: { en: "paused", fr: "pause", ar: "متوقّف" },
  boardFreeze: { en: "board freeze", fr: "gel du tableau", ar: "السبورة ثابتة" },
  play: { en: "Play", fr: "Lecture", ar: "تشغيل" },
  pause: { en: "Pause", fr: "Pause", ar: "إيقاف مؤقت" },
  restart: { en: "Restart", fr: "Recommencer", ar: "من البداية" },
  speed: { en: "Speed", fr: "Vitesse", ar: "السرعة" },
  seek: { en: "Seek", fr: "Position", ar: "الموضع" },
  roots: { en: "Roots", fr: "Racines", ar: "الجذور" },
  asymptotes: { en: "Asymptotes", fr: "Asymptotes", ar: "المقاربات" },
  extrema: { en: "Extrema", fr: "Extrema", ar: "القيم القصوى" },
  demoHint: {
    en: "Demo mode: Professor Munzer still + silent timeline (or HTML5 audio). HeyGen is not called without a key.",
    fr: "Mode démo : photo du professeur Munzer + timeline silencieuse (ou audio HTML5). HeyGen n’est pas appelé sans clé.",
    ar: "وضع تجريبي: صورة الأستاذ منذر مع خط زمني صامت (أو صوت HTML5). لا يُستدعى HeyGen بدون مفتاح.",
  },
  videoHint: {
    en: "HeyGen video is the clock: the math canvas seeks from video.currentTime.",
    fr: "La vidéo HeyGen est l’horloge : le tableau suit video.currentTime.",
    ar: "فيديو HeyGen هو الساعة: السبورة تتبع video.currentTime.",
  },
  demoVideoHint: {
    en: "Local placeholder clip (no HeyGen key). Canvas follows video.currentTime, then the clip loops while the lesson clock continues — pan/zoom does not pause audio.",
    fr: "Clip local de démo (pas de clé HeyGen). Le tableau suit video.currentTime, puis le clip boucle pendant que l’horloge continue — zoom/pan ne coupe pas l’audio.",
    ar: "مقطع محلي تجريبي (بدون مفتاح HeyGen). السبورة تتبع video.currentTime، ثم يتكرّر المقطع بينما تستمر ساعة الدرس — التحريك والتكبير لا يوقفان الصوت.",
  },
  syncClock: { en: "sync player (video → canvas)", fr: "lecteur sync (vidéo → tableau)", ar: "الفيديو والسبورة متزامنان" },
  interactHint: {
    en: "Pan, zoom, and hover the graph — the video keeps playing.",
    fr: "Déplacez, zoomez et survolez le graphe — la vidéo continue.",
    ar: "حرّك الرسم وكبّره ومرّر عليه — الفيديو يستمر.",
  },
  keyIdea: { en: "Key Idea / Exam Tip", fr: "Idée clé / Conseil d’épreuve", ar: "الفكرة الأساسية / نصيحة للامتحان" },
  variationTable: { en: "Table of variations", fr: "Tableau de variation", ar: "جدول التغيّرات" },
  boxedAnswer: { en: "Boxed Final Answer", fr: "Réponse encadrée", ar: "الجواب النهائي المؤطّر" },
  boxedAnswerMarks: { en: "Boxed Final Answer · barème", fr: "Réponse encadrée · barème", ar: "الجواب النهائي المؤطّر · سلّم العلامات" },
  voiceClock: {
    en: "Teacher voice is the clock: the math canvas follows the recording timestamps.",
    fr: "La voix du professeur est l’horloge : le tableau suit l’enregistrement.",
    ar: "صوت الأستاذ هو الساعة: السبورة تتبع توقيت التسجيل.",
  },
  voiceToMath: { en: "Voice-to-Math recording", fr: "Enregistrement Voix → Maths", ar: "تسجيل الشرح الصوتي" },
  resetView: { en: "Reset view", fr: "Réinitialiser la vue", ar: "إعادة ضبط العرض" },
  switchToFrench: "🌐 Switch to French / Passer en Français",
  switchToEnglish: "🌐 Switch to English / Passer en anglais",
  /** Arabic chrome: content (voice, board, captions) language picker. */
  contentLanguage: { en: "Explanation language", fr: "Langue de l’explication", ar: "لغة الشرح" },
  captions: { en: "Captions", fr: "Sous-titres", ar: "النص المرافق" },
  desmos: { en: "Desmos graph (optional)", fr: "Graphe Desmos (optionnel)", ar: "رسم Desmos (اختياري)" },
  fallbackPlot: { en: "Function Plot (SVG)", fr: "Function Plot (SVG)", ar: "رسم الدالة (SVG)" },
  swapFocus: { en: "Swap video / board", fr: "Inverser vidéo / tableau", ar: "تبديل الفيديو / السبورة" },
  focusVideo: { en: "Video on top", fr: "Vidéo en haut", ar: "الفيديو أولاً" },
  focusBoard: { en: "Board on top", fr: "Tableau en haut", ar: "السبورة أولاً" },
  chapters: { en: "Chapters", fr: "Chapitres", ar: "الفصول" },
  fullscreenVideo: { en: "Fullscreen video", fr: "Vidéo plein écran", ar: "فيديو بملء الشاشة" },
  fullscreenBoard: { en: "Fullscreen board", fr: "Tableau plein écran", ar: "سبورة بملء الشاشة" },
  exitFullscreen: { en: "Exit fullscreen", fr: "Quitter le plein écran", ar: "الخروج من ملء الشاشة" },
  quizEyebrow: { en: "In-video checkpoint", fr: "Point d’arrêt dans la vidéo", ar: "سؤال سريع أثناء الدرس" },
  quizRule: {
    en: "The lesson is paused. Check your answer to retry if it is wrong. Show solution unlocks Continue.",
    fr: "La leçon est en pause. Vérifiez la réponse — vous pouvez réessayer si elle est fausse. Afficher la solution débloque Continuer.",
    ar: "توقّف الدرس. تحقّق من إجابتك وأعد المحاولة إن كانت خاطئة، أو اعرض الحل لتتابع.",
  },
  quizCheck: { en: "Check answer", fr: "Vérifier", ar: "تحقّق" },
  quizShowSolution: { en: "Show solution", fr: "Afficher la solution", ar: "اعرض الحل" },
  quizContinue: { en: "Continue", fr: "Continuer", ar: "تابع" },
  quizWrong: { en: "Not yet — try another choice, or show the solution.", fr: "Pas encore — réessayez, ou affichez la solution.", ar: "ليس بعد. جرّب خياراً آخر أو اعرض الحل." },
  quizRight: { en: "Correct. Continue when you are ready.", fr: "Correct. Continuez quand vous voulez.", ar: "إجابة صحيحة. تابع متى كنت جاهزاً." },
  quizSolution: { en: "Solution", fr: "Solution", ar: "الحل" },
  teacherUnlock: { en: "Teacher tools", fr: "Outils enseignant", ar: "أدوات الأستاذ" },
  teacherLock: { en: "Hide teacher tools", fr: "Masquer les outils", ar: "إخفاء أدوات الأستاذ" },
  teacherEyebrow: { en: "Teacher / admin", fr: "Enseignant / admin", ar: "الأستاذ / الإدارة" },
  teacherTitle: { en: "Timeline events editor", fr: "Éditeur d’événements", ar: "محرّر أحداث الخط الزمني" },
  teacherEvents: { en: "events", fr: "événements", ar: "أحداث" },
  teacherApply: { en: "Apply live", fr: "Appliquer", ar: "طبّق مباشرة" },
  teacherSave: { en: "Save", fr: "Enregistrer", ar: "حفظ" },
  teacherSaving: { en: "Saving…", fr: "Enregistrement…", ar: "جارٍ الحفظ…" },
  teacherAdd: { en: "Add event", fr: "Ajouter un événement", ar: "أضف حدثاً" },
  teacherRemove: { en: "Remove", fr: "Retirer", ar: "إزالة" },
  teacherTime: { en: "Time (s)", fr: "Temps (s)", ar: "الوقت (ث)" },
  teacherType: { en: "Type", fr: "Type", ar: "النوع" },
  teacherExpression: { en: "Expression", fr: "Expression", ar: "العبارة" },
  teacherDomain: { en: "Domain", fr: "Domaine", ar: "المجال" },
  teacherHighlights: { en: "Highlights JSON", fr: "JSON des points", ar: "JSON النقاط المميّزة" },
  teacherQuestion: { en: "Quiz question", fr: "Question", ar: "سؤال الاختبار" },
  teacherChoices: { en: "Choices (one per line, optional id: text)", fr: "Choix (une ligne, id: texte)", ar: "الخيارات (سطر لكل خيار، اختياري id: نص)" },
  teacherCorrect: { en: "Correct id", fr: "id correct", ar: "id الصحيح" },
  teacherExplanation: { en: "Solution / explanation", fr: "Solution / explication", ar: "الحل / الشرح" },
  teacherPayload: { en: "Extra payload JSON", fr: "JSON payload extra", ar: "JSON إضافي" },
  teacherJsonMode: { en: "Edit raw JSON", fr: "JSON brut", ar: "تحرير JSON الخام" },
  teacherFormMode: { en: "Edit as list", fr: "Liste", ar: "تحرير كقائمة" },
  teacherApplied: { en: "Applied to the player (no reload).", fr: "Appliqué au lecteur (sans recharger).", ar: "طُبّق على المشغّل (بدون إعادة تحميل)." },
  teacherSaved: { en: "Saved to sessionStorage and /api/studio/events.", fr: "Enregistré dans sessionStorage et /api/studio/events.", ar: "حُفظ في sessionStorage و‎/api/studio/events." },

  phases: {
    introduction: { en: "1. Key Idea & domain D_f", fr: "1. Idée clé et ensemble D_f", ar: "1. الفكرة الأساسية ومجال التعريف" },
    rule_graph: { en: "2. Limits, variation, graph", fr: "2. Limites, variation, graphe", ar: "2. النهايات والتغيّرات والرسم" },
    real_example: { en: "3. Boxed official exercise", fr: "3. Exercice encadré", ar: "3. تمرين رسمي محلول" },
    common_mistake: { en: "4. Common pitfalls (barème)", fr: "4. Pièges fréquents (barème)", ar: "4. أخطاء شائعة وسلّم العلامات" },
  },
} as const;
