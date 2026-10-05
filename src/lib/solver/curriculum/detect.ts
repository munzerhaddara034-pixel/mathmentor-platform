import { isSolverCurriculum, type SolverCurriculum, type SolverLevel } from "./types.ts";

export type CurriculumInput = {
  question?: string;
  latex?: string;
  /** Certificate track hint from the form (brevet, gs, sat, university, …). PRIMARY for level. */
  track?: string;
  /** Explicit student choice in the solver form ("auto" or missing = detect). PRIMARY for curriculum. */
  selected?: string;
  /** Platform curriculum id (lebanese, ib, cambridge, ap, sat, saudi-gcc). PRIMARY when set. */
  platform?: string;
  /**
   * Explicit level from the WhatsApp picker (متوسط / ثانوي / جامعي). Wins over text heuristics.
   * Never invent this on the site — use track / selected / platform instead.
   */
  level?: SolverLevel;
};

export type CurriculumDecision = {
  curriculum: SolverCurriculum;
  level: SolverLevel;
  /** True when the statement asks for a proof / "show that". */
  proof: boolean;
  source: "selected" | "detected" | "track" | "platform" | "default" | "level_pick";
  /**
   * True when level was not grounded in an explicit student choice (track / selected / platform /
   * WhatsApp pick) or a clear text cue. WhatsApp must ask (buttons) instead of guessing secondary.
   */
  ambiguous: boolean;
};

const EXPLICIT: ReadonlyArray<[SolverCurriculum, RegExp]> = [
  ["ib", /\bIBDP\b|\bIB\b|analysis (?:and|&) approaches|applications (?:and|&) interpretation|\b(?:AA|AI)\s*(?:SL|HL)\b|markscheme|\bGDC\b/i],
  ["ap", /\bAP\s*(?:Calc|Calculus|Stat)|\bCalculus\s*(?:AB|BC)\b|free[- ]response|\bFRQ\b/i],
  ["sat_act", /\b(?:P?SAT|ACT)\b(?:\s*Math)?/],
  ["cambridge", /\bI?GCSE\b|\bA[- ]?Level\b|\bAS[- ]Level\b|\bCambridge\b|\bEdexcel\b|\b(?:9709|0580|0606|9231)\b/i],
  ["french_bac", /bac(?:calaur[ée]at)?\s+(?:fran[çc]ais|france|g[ée]n[ée]ral)|sp[ée]cialit[ée]\s+math|terminale\s+sp[ée]cialit[ée]/i],
  ["lebanese", /\bbrevet\b|leban|liban|لبنان|اللبنانية|الشهادة الرسمية|terminale\s*(?:gs|ls|se|lh)\b/i],
];

const UNIVERSITY =
  /universit|undergraduate|جامعي|جامعة|real analysis|linear algebra|alg[èe]bre lin[ée]aire|eigen(?:value|vector|space)|diagonali[sz]|valeurs? propres?|probl[èe]me de cauchy|ε\s*[–-]\s*δ|epsilon[\s–-]*delta|bolzano|heine|cauchy sequence|suite de cauchy|jordan (?:form|normal)|topolog|measure theory|group theory|abstract algebra|partial differential/i;

const PROOF = /\bprove\b|\bproof\b|show that|d[ée]montrer|montrer que|برهن|أثبت|بيّن أن|بين أن/i;

const TRACK_TO_CURRICULUM: Readonly<Record<string, SolverCurriculum>> = {
  brevet: "lebanese",
  ls: "lebanese",
  gs: "lebanese",
  se: "lebanese",
  lh: "lebanese",
  eb7: "lebanese",
  eb8: "lebanese",
  s1: "lebanese",
  sat: "sat_act",
  university: "university",
};

const PLATFORM_TO_CURRICULUM: Readonly<Record<string, SolverCurriculum>> = {
  lebanese: "lebanese",
  ib: "ib",
  cambridge: "cambridge",
  ap: "ap",
  sat: "sat_act",
  "saudi-gcc": "general",
};

const MIDDLE_TRACKS = new Set(["brevet", "eb7", "eb8"]);
const SECONDARY_TRACKS = new Set(["ls", "gs", "se", "lh", "s1", "sat"]);
const MIDDLE_TEXT = /\bbrevet\b|grade\s*[789]\b|\bEB\s*[789]\b|الصف\s*(?:السابع|الثامن|التاسع)|متوسط|coll[eè]ge/i;
/** Text that clearly picks secondary (not middle, not university). */
const SECONDARY_TEXT =
  /terminale\s*(?:gs|ls|se|lh)?\b|ثانوي|bac(?:calaur[ée]at)?|\bIB\b|\bAP\s*(?:Calc|Calculus|Stat)?|\b(?:P?SAT|ACT)\b|\bI?GCSE\b|\bA[- ]?Level\b/i;

/** Level implied by an explicit form track — never overridden by question keywords. */
export function levelFromTrack(track: string | undefined): SolverLevel | undefined {
  if (!track) return undefined;
  const key = track.trim().toLowerCase();
  if (key === "university") return "university";
  if (MIDDLE_TRACKS.has(key)) return "middle";
  if (SECONDARY_TRACKS.has(key)) return "secondary";
  if (TRACK_TO_CURRICULUM[key]) return "secondary";
  return undefined;
}

/** Default level when the student picked a curriculum on the form (no track). */
export function levelFromCurriculum(curriculum: SolverCurriculum): SolverLevel {
  return curriculum === "university" ? "university" : "secondary";
}

/** Track hint the WhatsApp / solver pipeline can pass after a level pick. */
export function trackForLevel(level: SolverLevel): string {
  if (level === "middle") return "brevet";
  if (level === "university") return "university";
  return "gs";
}

function pickCurriculum(input: CurriculumInput, text: string): Pick<CurriculumDecision, "curriculum" | "source"> {
  if (input.selected && input.selected !== "auto" && isSolverCurriculum(input.selected)) {
    return { curriculum: input.selected, source: "selected" };
  }
  // Explicit track on the form is primary for curriculum too (before free-text heuristics).
  const fromTrack = input.track ? TRACK_TO_CURRICULUM[input.track.trim().toLowerCase()] : undefined;
  if (fromTrack) return { curriculum: fromTrack, source: "track" };
  const fromPlatform = input.platform ? PLATFORM_TO_CURRICULUM[input.platform] : undefined;
  if (fromPlatform) return { curriculum: fromPlatform, source: "platform" };
  for (const [id, pattern] of EXPLICIT) {
    if (pattern.test(text)) return { curriculum: id, source: "detected" };
  }
  if (UNIVERSITY.test(text)) return { curriculum: "university", source: "detected" };
  return { curriculum: "general", source: "default" };
}

/**
 * Decide the exam system and difficulty tier for a question. Pure and synchronous.
 * Explicit form fields (track / selected / platform) and WhatsApp level picks are PRIMARY —
 * question keywords never override them. When nothing grounds the level, `ambiguous` is true
 * (WhatsApp must ask; the site still gets a secondary placeholder for backwards compatibility).
 */
export function detectCurriculum(input: CurriculumInput): CurriculumDecision {
  const text = `${input.question ?? ""}\n${input.latex ?? ""}`;
  const picked = pickCurriculum(input, text);
  const proof = PROOF.test(text);

  if (input.level === "middle" || input.level === "secondary" || input.level === "university") {
    let curriculum = picked.curriculum;
    if (input.level === "university") curriculum = "university";
    else if (curriculum === "university") curriculum = input.level === "middle" ? "lebanese" : "general";
    else if (input.level === "middle" && curriculum === "general") curriculum = "lebanese";
    return { curriculum, level: input.level, proof, source: "level_pick", ambiguous: false };
  }

  const fromTrack = levelFromTrack(input.track);
  if (fromTrack) {
    return { ...picked, level: fromTrack, proof, ambiguous: false };
  }

  if (input.selected && input.selected !== "auto" && isSolverCurriculum(input.selected)) {
    return { ...picked, level: levelFromCurriculum(input.selected), proof, ambiguous: false };
  }

  if (input.platform && PLATFORM_TO_CURRICULUM[input.platform]) {
    const level = input.platform === "sat" ? "secondary" : levelFromCurriculum(PLATFORM_TO_CURRICULUM[input.platform]);
    return { ...picked, level, proof, ambiguous: false };
  }

  // Text heuristics only — no explicit form / pick.
  if (UNIVERSITY.test(text) || picked.curriculum === "university") {
    return { curriculum: picked.curriculum === "general" ? "university" : picked.curriculum, level: "university", proof, source: picked.source, ambiguous: false };
  }
  if (MIDDLE_TEXT.test(text)) {
    return { curriculum: picked.curriculum === "general" ? "lebanese" : picked.curriculum, level: "middle", proof, source: picked.source === "default" ? "detected" : picked.source, ambiguous: false };
  }
  if (SECONDARY_TEXT.test(text) || (picked.source === "detected" && picked.curriculum !== "general" && picked.curriculum !== "lebanese")) {
    return { ...picked, level: "secondary", proof, ambiguous: false };
  }
  if (picked.source === "detected" && picked.curriculum === "lebanese") {
    // "terminale gs" etc. already hit SECONDARY_TEXT; remaining Lebanese cues without middle → secondary.
    return { ...picked, level: "secondary", proof, ambiguous: false };
  }

  return { curriculum: picked.curriculum, level: "secondary", proof, source: picked.source, ambiguous: true };
}
