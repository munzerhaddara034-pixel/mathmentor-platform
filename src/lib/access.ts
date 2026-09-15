import type { AcademyLesson } from "./academyLessons";
import type { GradeTrack } from "./types";

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const PROMO_CODE_LENGTH = 12;

export type ScopeKind = "plan" | "track" | "lesson";

export type EntitlementRecord = {
  scopeKind: ScopeKind;
  scopeId: string;
  sourceCode?: string;
  unlockedAt?: string;
};

export type PromoCodeRecord = {
  code: string;
  scopeKind: ScopeKind;
  scopeId: string;
  createdAt: string;
  expiresAt?: string;
  batchId?: string;
  note?: string;
  used: boolean;
  redeemedBy?: string;
  redeemedAt?: string;
  redeemedName?: string;
  redeemedPhone?: string;
};

export const PLAN_TRACKS: Record<string, GradeTrack[]> = {
  "g7-9": ["grade-7", "grade-8", "grade-9"],
  "g11-12": ["grade-11", "grade-12"],
  sat: ["sat"],
  all: ["grade-7", "grade-8", "grade-9", "grade-11", "grade-12", "sat"],
};

export const CERTIFICATE_TRACK: Record<string, GradeTrack> = {
  Brevet: "grade-9",
  LS: "grade-12",
  GS: "grade-12",
  SE: "grade-12",
  LH: "grade-12",
};

export const SCOPE_OPTIONS: { kind: ScopeKind; id: string; label: string }[] = [
  { kind: "plan", id: "all", label: "المنصة كاملة" },
  { kind: "plan", id: "g7-9", label: "الصفوف 7–9 · الشهادة المتوسطة" },
  { kind: "plan", id: "g11-12", label: "الصفوف 11–12 · الثانوية" },
  { kind: "plan", id: "sat", label: "رياضيات SAT" },
  { kind: "track", id: "grade-12", label: "صف 12 فقط" },
  { kind: "track", id: "grade-9", label: "صف 9 / Brevet فقط" },
  { kind: "track", id: "grade-7", label: "صف 7 فقط" },
  { kind: "track", id: "grade-8", label: "صف 8 فقط" },
  { kind: "track", id: "grade-11", label: "صف 11 فقط" },
  { kind: "lesson", id: "grade-12-ch2", label: "وحدة الاستمرار فقط" },
  { kind: "lesson", id: "grade-12-ch3", label: "وحدة المشتقة فقط" },
  { kind: "lesson", id: "grade-9-ch4", label: "طاليس / هندسة Brevet فقط" },
];

export const DEMO_PROMO_CODES = [
  { code: "MMUNLOCKALL1", scopeKind: "plan" as const, scopeId: "all", note: "تجريبي — المنصة كاملة" },
  { code: "MMG12CERTIF1", scopeKind: "plan" as const, scopeId: "g11-12", note: "تجريبي — صفوف 11–12" },
  { code: "MMBREVETPATH", scopeKind: "plan" as const, scopeId: "g7-9", note: "تجريبي — مسار المتوسطة" },
  { code: "MMCONTCH2LS1", scopeKind: "lesson" as const, scopeId: "grade-12-ch2", note: "تجريبي — وحدة الاستمرار" },
];

export function normalizePromoCode(raw: string) {
  return raw.replace(/[\s\-]/g, "").toUpperCase();
}

export function isValidPromoCode(raw: string) {
  return new RegExp(`^[A-Z0-9]{${PROMO_CODE_LENGTH}}$`).test(normalizePromoCode(raw));
}

export function scopeLabel(kind: ScopeKind, id: string) {
  return SCOPE_OPTIONS.find((item) => item.kind === kind && item.id === id)?.label ?? `${kind}:${id}`;
}

export function tracksFromEntitlements(ents: EntitlementRecord[]) {
  const tracks = new Set<string>();
  for (const item of ents) {
    if (item.scopeKind === "plan") {
      for (const track of PLAN_TRACKS[item.scopeId] ?? []) tracks.add(track);
    } else if (item.scopeKind === "track") {
      tracks.add(item.scopeId);
    }
  }
  return tracks;
}

export function lessonsFromEntitlements(ents: EntitlementRecord[]) {
  return new Set(ents.filter((item) => item.scopeKind === "lesson").map((item) => item.scopeId));
}

export function isPreviewLesson(lesson: Pick<AcademyLesson, "chapter">) {
  return lesson.chapter <= 1;
}

export function canAccessLesson(
  lesson: Pick<AcademyLesson, "id" | "track" | "chapter">,
  ents: EntitlementRecord[],
  role?: string | null,
) {
  if (role === "teacher") return true;
  if (isPreviewLesson(lesson)) return true;
  if (tracksFromEntitlements(ents).has(lesson.track)) return true;
  return lessonsFromEntitlements(ents).has(lesson.id);
}

export function canAccessExamCertificate(certificate: string, ents: EntitlementRecord[], role?: string | null) {
  if (role === "teacher") return true;
  const track = CERTIFICATE_TRACK[certificate];
  if (!track) return tracksFromEntitlements(ents).size > 0;
  return tracksFromEntitlements(ents).has(track);
}

export function canAccessTrack(track: string, ents: EntitlementRecord[], role?: string | null) {
  if (role === "teacher") return true;
  return tracksFromEntitlements(ents).has(track);
}

export function chaptersFromScenes(scenes: { title: string; durationSeconds?: number }[]) {
  let start = 0;
  return scenes.map((scene, index) => {
    const chapter = {
      id: `ch-${index + 1}`,
      title: scene.title || `فصل ${index + 1}`,
      start,
    };
    start += Math.max(scene.durationSeconds ?? 10, 1);
    return chapter;
  });
}
