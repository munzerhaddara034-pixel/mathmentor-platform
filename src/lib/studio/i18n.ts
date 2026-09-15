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
  phases: {
    introduction: { en: "1. Concept definition", fr: "1. Définition" },
    rule_graph: { en: "2. Rule & graph", fr: "2. Règle et graphe" },
    real_example: { en: "3. Worked example", fr: "3. Exemple résolu" },
    common_mistake: { en: "4. Common mistake", fr: "4. Erreur fréquente" },
  },
} as const;
