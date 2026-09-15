import {
  canAccessExamCertificate,
  canAccessLesson,
  canAccessTrack,
  tracksFromEntitlements,
  lessonsFromEntitlements,
  type EntitlementRecord,
} from "@/lib/access";
import { academyLessons } from "@/lib/academyLessons";
import { asProgressEntries } from "@/lib/auth/db";
import { isContentEnabled, listContentOverrides, listEntitlements, publishedLessons } from "@/lib/auth/entitlements";
import type { SessionUser } from "@/lib/auth/types";
import type { ProgressEntry } from "@/lib/types";

export type AccessPayload = {
  user: SessionUser;
  entitlements: EntitlementRecord[];
  unlockedTracks: string[];
  unlockedLessons: string[];
  disabledLessons: string[];
  disabledBanks: string[];
  disabledCertificates: string[];
  progress: ProgressEntry[];
};

export function buildAccessPayload(user: SessionUser): AccessPayload {
  const entitlements = user.role === "teacher" ? [] : listEntitlements(user.id);
  const overrides = listContentOverrides();
  return {
    user,
    entitlements,
    unlockedTracks: [...tracksFromEntitlements(entitlements)],
    unlockedLessons: [...lessonsFromEntitlements(entitlements)],
    disabledLessons: overrides.filter((item) => item.kind === "lesson" && !item.enabled).map((item) => item.key.replace(/^lesson:/, "")),
    disabledBanks: overrides.filter((item) => item.kind === "bank" && !item.enabled).map((item) => item.key.replace(/^bank:/, "")),
    disabledCertificates: overrides
      .filter((item) => item.kind === "exam-cert" && !item.enabled)
      .map((item) => item.key.replace(/^exam-cert:/, "")),
    progress: asProgressEntries(user.id),
  };
}

export function studentCanWatch(user: SessionUser, lessonId: string) {
  const published = publishedLessons().find((item) => item.id === lessonId);
  const lesson = published ?? academyLessons.find((item) => item.id === lessonId);
  if (!lesson) return { ok: false as const, reason: "missing" as const };
  if (published && !published.enabled && user.role !== "teacher") {
    return { ok: false as const, reason: "disabled" as const };
  }
  const entitlements = user.role === "teacher" ? [] : listEntitlements(user.id);
  if (!canAccessLesson(lesson, entitlements, user.role)) return { ok: false as const, reason: "locked" as const };
  return { ok: true as const, lesson, entitlements };
}

export function studentCanTakeExam(user: SessionUser, certificate: string) {
  if (!isContentEnabled("exam-cert", certificate) && user.role !== "teacher") {
    return false;
  }
  const entitlements = user.role === "teacher" ? [] : listEntitlements(user.id);
  return canAccessExamCertificate(certificate, entitlements, user.role);
}

export function studentCanTakeBank(user: SessionUser, bankId: string, track: string) {
  if (!isContentEnabled("bank", bankId) && user.role !== "teacher") return false;
  const entitlements = user.role === "teacher" ? [] : listEntitlements(user.id);
  return canAccessTrack(track, entitlements, user.role);
}
