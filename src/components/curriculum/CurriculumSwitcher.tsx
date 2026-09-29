"use client";

import { useCurriculum } from "./CurriculumProvider";
import type { CurriculumId } from "@/lib/curriculum/types";
import { SWITCHER_CURRICULUM_IDS } from "@/lib/curriculum/types";

export function CurriculumSwitcher() {
  const { curriculumId, setCurriculumId, curriculum, catalog, ready } = useCurriculum();

  return (
    <label className="mm-curriculum-switcher" title={`${curriculum.labelEn} / ${curriculum.labelAr}`}>
      <span className="mm-curriculum-switcher-label" lang="ar" dir="rtl">
        المنهج
      </span>
      <span className="mm-curriculum-switcher-label-en" lang="en">
        Curriculum
      </span>
      <select
        className="mm-curriculum-select"
        value={curriculumId}
        disabled={!ready}
        aria-label="Curriculum switcher"
        onChange={(event) => setCurriculumId(event.target.value as CurriculumId)}
      >
        {SWITCHER_CURRICULUM_IDS.map((id) => {
          const item = catalog.find((entry) => entry.id === id);
          if (!item) return null;
          return (
            <option key={item.id} value={item.id}>
              {item.labelEn} · {item.labelAr}
            </option>
          );
        })}
      </select>
    </label>
  );
}
