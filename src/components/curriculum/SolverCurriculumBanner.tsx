"use client";

import { useCurriculum } from "./CurriculumProvider";

/** Current curriculum + its key terms, Arabic first with the English term isolated LTR. */
export function SolverCurriculumBanner() {
  const { curriculum, terminology, ready } = useCurriculum();
  if (!ready) return null;
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
