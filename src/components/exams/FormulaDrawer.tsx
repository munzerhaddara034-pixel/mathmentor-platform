"use client";

import { FORMULA_SHEETS } from "@/lib/exams/formulas";
import { Katex } from "@/components/studio/Katex";
import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { examsMessages } from "@/lib/i18n/ns/exams";

export function FormulaDrawer() {
  const { locale } = useI18n();
  const t = examsMessages[locale].formulas;
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(FORMULA_SHEETS[0]?.id ?? "logs");
  const current = FORMULA_SHEETS.find((item) => item.id === sheet) ?? FORMULA_SHEETS[0];
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        {t.open}
      </button>
      {open ? (
        <aside className="formula-drawer">
          <header>
            <h2>{t.title}</h2>
            <button type="button" className="ghost" onClick={() => setOpen(false)} aria-label={t.close}>
              ×
            </button>
          </header>
          <div className="formula-tabs">
            {FORMULA_SHEETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === current.id ? "btn dark" : "btn"}
                onClick={() => setSheet(item.id)}
              >
                {isAr ? item.titleAr || item.title : item.title}
              </button>
            ))}
          </div>
          <h3>
            {isAr ? current.titleAr || current.title : current.title}
          </h3>
          <ul className="formula-list">
            {current.items.map((item) => (
              <li key={item.latex}>
                <span className="muted">{item.name}</span>
                <Katex tex={item.latex} display />
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </>
  );
}
