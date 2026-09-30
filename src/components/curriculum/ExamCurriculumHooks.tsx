"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurriculum } from "./CurriculumProvider";
import { examsUrlForCurriculum } from "@/lib/exams/curriculumHub";
import type { CurriculumId } from "@/lib/curriculum/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import { examsMessages } from "@/lib/i18n/ns/exams";
import { rich } from "@/lib/i18n/rich";

/**
 * When the header curriculum changes on /exams, sync the URL:
 * - Lebanese → /exams (all Brevet + Terminale)
 * - SAT → /exams?track=sat
 * - GCC / IB / Cambridge / AP → /exams?curriculum=<id> (sample/planned cards)
 *
 * Manual track chips still work until the next curriculum change.
 */
export function ExamCurriculumHooks() {
  const { curriculumId, ready, curriculum } = useCurriculum();
  const { locale } = useI18n();
  const t = examsMessages[locale].hub;
  const router = useRouter();
  const pathname = usePathname();
  const lastCurriculum = useRef<CurriculumId | null>(null);

  useEffect(() => {
    if (!ready || pathname !== "/exams") return;
    if (lastCurriculum.current === curriculumId) return;
    const previous = lastCurriculum.current;
    lastCurriculum.current = curriculumId;
    if (previous === null) {
      // First hydrate: do not clobber a deep-linked ?track= / ?curriculum=
      return;
    }
    router.replace(examsUrlForCurriculum(curriculumId));
  }, [ready, curriculumId, pathname, router]);

  if (!ready) return null;
  if (curriculum.contentPhase === "default") return null;

  return (
    <p className="muted mm-curriculum-exam-note" role="status">
      {rich(t.archiveNote, {
        curriculum: locale === "ar" ? curriculum.labelAr : curriculum.labelEn,
        phase: <strong>{curriculum.contentPhase}</strong>,
        link: <a href="/math-solver">/math-solver</a>,
      })}
    </p>
  );
}
