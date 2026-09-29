"use client";

import { useCurriculum } from "./CurriculumProvider";

export function SolverCurriculumBanner() {
  const { curriculum, terminology, ready } = useCurriculum();
  if (!ready) return null;
  return (
    <p className="mm-curriculum-banner" role="status">
      <strong>{curriculum.labelEn}</strong>
      <span dir="rtl" lang="ar">
        {" "}
        · {curriculum.labelAr}
      </span>
      {" — "}
      {terminology.derivative.en} / <span dir="rtl">{terminology.derivative.ar}</span>
      {" · "}
      {terminology.limits.en} / <span dir="rtl">{terminology.limits.ar}</span>
      {curriculum.contentPhase !== "default" ? (
        <span className="muted"> ({curriculum.contentPhase} content)</span>
      ) : null}
    </p>
  );
}
