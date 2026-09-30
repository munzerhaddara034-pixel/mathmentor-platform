"use client";

import { useCurriculum } from "./CurriculumProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { CurriculumId } from "@/lib/curriculum/types";
import { SWITCHER_CURRICULUM_IDS } from "@/lib/curriculum/types";

export function CurriculumSwitcher() {
  const { curriculumId, setCurriculumId, curriculum, catalog, ready } = useCurriculum();
  const { m, locale } = useI18n();
  const labelOf = (item: { labelEn: string; labelAr: string }) => (locale === "ar" ? item.labelAr : item.labelEn);

  return (
    <label className="mm-curriculum-switcher" title={labelOf(curriculum)}>
      <span className="mm-curriculum-switcher-label">{m.common.curriculum}</span>
      <select
        className="mm-curriculum-select"
        value={curriculumId}
        disabled={!ready}
        aria-label={m.common.curriculum}
        onChange={(event) => setCurriculumId(event.target.value as CurriculumId)}
      >
        {SWITCHER_CURRICULUM_IDS.map((id) => {
          const item = catalog.find((entry) => entry.id === id);
          if (!item) return null;
          return (
            <option key={item.id} value={item.id}>
              {labelOf(item)}
            </option>
          );
        })}
      </select>
    </label>
  );
}
