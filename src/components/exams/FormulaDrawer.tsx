"use client";

import { FORMULA_SHEETS } from "@/lib/exams/formulas";
import { Katex } from "@/components/studio/Katex";
import { useState } from "react";

export function FormulaDrawer() {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(FORMULA_SHEETS[0]?.id ?? "logs");
  const current = FORMULA_SHEETS.find((item) => item.id === sheet) ?? FORMULA_SHEETS[0];
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Formula sheets / القوانين
      </button>
      {open ? (
        <aside className="formula-drawer" dir="ltr">
          <header>
            <h2>Official cheat sheets</h2>
            <button type="button" className="ghost" onClick={() => setOpen(false)} aria-label="Close">
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
                {item.title}
              </button>
            ))}
          </div>
          <h3>
            {current.title} · <span dir="rtl">{current.titleAr}</span>
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
