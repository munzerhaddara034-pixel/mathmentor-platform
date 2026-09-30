"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { useCurriculum } from "./CurriculumProvider";

/** Current curriculum + its key terms: Arabic first (English term isolated LTR) in `ar`, English otherwise. */
export function SolverCurriculumBanner() {
  const { curriculum, terminology, ready } = useCurriculum();
  const { locale } = useI18n();
  if (!ready) return null;
  if (locale !== "ar") {
    return (
      <p className="mm-curriculum-banner" role="status">
        <strong>{curriculum.labelEn}</strong>
        {" · "}
        {terminology.derivative.en} · {terminology.limits.en}
      </p>
    );
  }
  return (
    <p className="mm-curriculum-banner" role="status">
      <strong>{curriculum.labelAr}</strong>
      {" · "}
      {terminology.derivative.ar} (<bdi dir="ltr">{terminology.derivative.en}</bdi>)
      {" · "}
      {terminology.limits.ar} (<bdi dir="ltr">{terminology.limits.en}</bdi>)
    </p>
  );
}
