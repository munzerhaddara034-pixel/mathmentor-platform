"use client";

import { useNs } from "@/components/i18n/useNs";
import { studioMessages } from "@/lib/i18n/ns/studio";

export function TeacherQualityChecklist() {
  const t = useNs(studioMessages).checklist;
  return (
    <section className="teacher-checklist" aria-label={t.eyebrow}>
      <p className="eyebrow">{t.eyebrow}</p>
      <h2>{t.title}</h2>
      <p className="muted">{t.lead}</p>
      <ol>
        {t.items.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
