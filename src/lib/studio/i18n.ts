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
  eyebrow: { en: "Interactive video & explanation studio", fr: "Studio vidéo interactif et explications" },
  canvas: { en: "Dynamic math canvas", fr: "Tableau mathématique dynamique" },
  canvasSub: { en: "Graphs · equations · variation table", fr: "Graphes · équations · tableau de variation" },
  waiting: { en: "Waiting for the lesson clock…", fr: "En attente du début de la leçon…" },
  avatar: { en: "Interactive video / AI avatar", fr: "Vidéo interactive / avatar IA" },
  freeze: { en: "Look at the board", fr: "Regardez le tableau" },
  speaking: { en: "speaking", fr: "en train d’expliquer" },
  paused: { en: "paused", fr: "pause" },
  boardFreeze: { en: "board freeze", fr: "gel du tableau" },
  play: { en: "Play", fr: "Lecture" },
  pause: { en: "Pause", fr: "Pause" },
  restart: { en: "Restart", fr: "Recommencer" },
  speed: { en: "Speed", fr: "Vitesse" },
  seek: { en: "Seek", fr: "Position" },
  roots: { en: "Roots", fr: "Racines" },
  asymptotes: { en: "Asymptotes", fr: "Asymptotes" },
  extrema: { en: "Extrema", fr: "Extrema" },
  demoHint: {
    en: "Demo mode: Professor Munzer still + silent timeline (or HTML5 audio). HeyGen is not called without a key.",
    fr: "Mode démo : photo du professeur Munzer + timeline silencieuse (ou audio HTML5). HeyGen n’est pas appelé sans clé.",
  },
  videoHint: {
    en: "HeyGen video is the clock: the math canvas seeks from video.currentTime.",
    fr: "La vidéo HeyGen est l’horloge : le tableau suit video.currentTime.",
  },
  demoVideoHint: {
    en: "Local placeholder clip (no HeyGen key). Canvas follows video.currentTime, then the clip loops while the lesson clock continues — pan/zoom does not pause audio.",
    fr: "Clip local de démo (pas de clé HeyGen). Le tableau suit video.currentTime, puis le clip boucle pendant que l’horloge continue — zoom/pan ne coupe pas l’audio.",
  },
  syncClock: { en: "sync player (video → canvas)", fr: "lecteur sync (vidéo → tableau)" },
  interactHint: {
    en: "Pan, zoom, and hover the graph — the video keeps playing.",
    fr: "Déplacez, zoomez et survolez le graphe — la vidéo continue.",
  },
  resetView: { en: "Reset view", fr: "Réinitialiser la vue" },
  switchToFrench: "🌐 Switch to French / Passer en Français",
  switchToEnglish: "🌐 Switch to English / Passer en anglais",
  desmos: { en: "Desmos graph (optional)", fr: "Graphe Desmos (optionnel)" },
  fallbackPlot: { en: "Function Plot (SVG)", fr: "Function Plot (SVG)" },
  swapFocus: { en: "Swap video / board", fr: "Inverser vidéo / tableau" },
  focusVideo: { en: "Video on top", fr: "Vidéo en haut" },
  focusBoard: { en: "Board on top", fr: "Tableau en haut" },
  chapters: { en: "Chapters", fr: "Chapitres" },
  fullscreenVideo: { en: "Fullscreen video", fr: "Vidéo plein écran" },
  fullscreenBoard: { en: "Fullscreen board", fr: "Tableau plein écran" },
  exitFullscreen: { en: "Exit fullscreen", fr: "Quitter le plein écran" },
  quizEyebrow: { en: "In-video checkpoint", fr: "Point d’arrêt dans la vidéo" },
  quizRule: {
    en: "The lesson is paused. Check your answer to retry if it is wrong. Show solution unlocks Continue.",
    fr: "La leçon est en pause. Vérifiez la réponse — vous pouvez réessayer si elle est fausse. Afficher la solution débloque Continuer.",
  },
  quizCheck: { en: "Check answer", fr: "Vérifier" },
  quizShowSolution: { en: "Show solution", fr: "Afficher la solution" },
  quizContinue: { en: "Continue", fr: "Continuer" },
  quizWrong: { en: "Not yet — try another choice, or show the solution.", fr: "Pas encore — réessayez, ou affichez la solution." },
  quizRight: { en: "Correct. Continue when you are ready.", fr: "Correct. Continuez quand vous voulez." },
  quizSolution: { en: "Solution", fr: "Solution" },
  teacherUnlock: { en: "Teacher tools", fr: "Outils enseignant" },
  teacherLock: { en: "Hide teacher tools", fr: "Masquer les outils" },
  teacherEyebrow: { en: "Teacher / admin", fr: "Enseignant / admin" },
  teacherTitle: { en: "Timeline events editor", fr: "Éditeur d’événements" },
  teacherEvents: { en: "events", fr: "événements" },
  teacherApply: { en: "Apply live", fr: "Appliquer" },
  teacherSave: { en: "Save", fr: "Enregistrer" },
  teacherSaving: { en: "Saving…", fr: "Enregistrement…" },
  teacherAdd: { en: "Add event", fr: "Ajouter un événement" },
  teacherRemove: { en: "Remove", fr: "Retirer" },
  teacherTime: { en: "Time (s)", fr: "Temps (s)" },
  teacherType: { en: "Type", fr: "Type" },
  teacherExpression: { en: "Expression", fr: "Expression" },
  teacherDomain: { en: "Domain", fr: "Domaine" },
  teacherHighlights: { en: "Highlights JSON", fr: "JSON des points" },
  teacherQuestion: { en: "Quiz question", fr: "Question" },
  teacherChoices: { en: "Choices (one per line, optional id: text)", fr: "Choix (une ligne, id: texte)" },
  teacherCorrect: { en: "Correct id", fr: "id correct" },
  teacherExplanation: { en: "Solution / explanation", fr: "Solution / explication" },
  teacherPayload: { en: "Extra payload JSON", fr: "JSON payload extra" },
  teacherJsonMode: { en: "Edit raw JSON", fr: "JSON brut" },
  teacherFormMode: { en: "Edit as list", fr: "Liste" },
  teacherApplied: { en: "Applied to the player (no reload).", fr: "Appliqué au lecteur (sans recharger)." },
  teacherSaved: { en: "Saved to sessionStorage and /api/studio/events.", fr: "Enregistré dans sessionStorage et /api/studio/events." },

  phases: {
    introduction: { en: "1. Key Idea & domain D_f", fr: "1. Idée clé et ensemble D_f" },
    rule_graph: { en: "2. Limits, variation, graph", fr: "2. Limites, variation, graphe" },
    real_example: { en: "3. Boxed official exercise", fr: "3. Exercice encadré" },
    common_mistake: { en: "4. Common pitfalls (barème)", fr: "4. Pièges fréquents (barème)" },
  },
} as const;
