import { isSolverCurriculum, type SolverCurriculum, type SolverLevel } from "./types.ts";

export type CurriculumInput = {
  question?: string;
  latex?: string;
  /** Certificate track hint from the form (brevet, gs, sat, university, …). */
  track?: string;
  /** Explicit student choice in the solver form ("auto" or missing = detect). */
  selected?: string;
  /** Platform curriculum id (lebanese, ib, cambridge, ap, sat, saudi-gcc). */
  platform?: string;
};

export type CurriculumDecision = {
  curriculum: SolverCurriculum;
  level: SolverLevel;
  /** True when the statement asks for a proof / "show that". */
  proof: boolean;
  source: "selected" | "detected" | "track" | "platform" | "default";
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
const MIDDLE_TEXT = /\bbrevet\b|grade\s*[789]\b|\bEB\s*[789]\b|الصف\s*(?:السابع|الثامن|التاسع)/i;

function pickCurriculum(input: CurriculumInput, text: string): Pick<CurriculumDecision, "curriculum" | "source"> {
  if (input.selected && input.selected !== "auto" && isSolverCurriculum(input.selected)) {
    return { curriculum: input.selected, source: "selected" };
  }
  for (const [id, pattern] of EXPLICIT) {
    if (pattern.test(text)) return { curriculum: id, source: "detected" };
  }
  if (UNIVERSITY.test(text)) return { curriculum: "university", source: "detected" };
  const fromTrack = input.track ? TRACK_TO_CURRICULUM[input.track] : undefined;
  if (fromTrack) return { curriculum: fromTrack, source: "track" };
  const fromPlatform = input.platform ? PLATFORM_TO_CURRICULUM[input.platform] : undefined;
  if (fromPlatform) return { curriculum: fromPlatform, source: "platform" };
  return { curriculum: "general", source: "default" };
}

/** Decide the exam system and difficulty tier for a question. Pure and synchronous. */
export function detectCurriculum(input: CurriculumInput): CurriculumDecision {
  const text = `${input.question ?? ""}\n${input.latex ?? ""}`;
  const picked = pickCurriculum(input, text);
  const university = picked.curriculum === "university" || input.track === "university" || UNIVERSITY.test(text);
  const middle =
    !university && picked.curriculum !== "sat_act" && (MIDDLE_TRACKS.has(input.track ?? "") || MIDDLE_TEXT.test(text));
  const level: SolverLevel = university ? "university" : middle ? "middle" : "secondary";
  return { ...picked, level, proof: PROOF.test(text) };
}
