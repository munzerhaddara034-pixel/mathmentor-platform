"use client";

import { useEffect, useRef, useState } from "react";
import type { GraphPayload, HighlightPayload } from "@/lib/studio/timeline";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import { hasDesmosKey, jsFnToDesmosLatex, loadDesmosApi, type DesmosCalculator } from "@/lib/studio/desmos";
import { FunctionGraph } from "./FunctionGraph";

type Props = {
  spec: GraphPayload;
  highlights: HighlightPayload[];
  language: LessonLocale;
  progress: number;
};

export function DesmosGraph({ spec, highlights, language, progress }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculator | null>(null);
  const [engine, setEngine] = useState<"desmos" | "fallback" | "pending">(
    spec.kind === "argand" || !spec.fn || !hasDesmosKey() ? "fallback" : "pending",
  );

  useEffect(() => {
    if (spec.kind === "argand" || !spec.fn || !hasDesmosKey()) {
      setEngine("fallback");
      return;
    }
    let cancelled = false;
    const host = hostRef.current;

    void loadDesmosApi()
      .then((Desmos) => {
        if (cancelled) return;
        const el = hostRef.current;
        if (!el) {
          setEngine("fallback");
          return;
        }
        calcRef.current?.destroy();
        const calculator = Desmos.GraphingCalculator(el, {
          expressions: false,
          settingsMenu: false,
          zoomButtons: true,
          keypad: false,
          expressionsTopbar: false,
          border: false,
          color: "#10213d",
        });
        calcRef.current = calculator;
        const xDomain = spec.xDomain ?? [-3, 2];
        const yDomain = spec.yDomain ?? [-4, 8];
        calculator.setMathBounds({
          left: xDomain[0],
          right: xDomain[1],
          bottom: yDomain[0],
          top: yDomain[1],
        });
        calculator.setExpression({
          id: "f",
          latex: jsFnToDesmosLatex(spec.fn ?? "x"),
          color: "#d9aa53",
        });
        highlights.forEach((item, index) => {
          if (typeof item.x === "number" && typeof item.y === "number") {
            calculator.setExpression({
              id: `pt-${index}`,
              latex: `(${item.x},${item.y})`,
              label: item.label ? pickText(item.label, language) : "",
              showLabel: true,
              color: item.kind === "extrema" ? "#f472b6" : item.kind === "root" ? "#f97316" : "#38bdf8",
            });
          }
          if (item.kind === "asymptote" && item.axis === "y" && typeof item.value === "number") {
            calculator.setExpression({
              id: `asy-${index}`,
              latex: `y=${item.value}`,
              color: "#38bdf8",
              lineStyle: "DASHED",
            });
          }
        });
        setEngine("desmos");
      })
      .catch(() => {
        if (!cancelled) setEngine("fallback");
      });

    return () => {
      cancelled = true;
      calcRef.current?.destroy();
      calcRef.current = null;
      if (host) host.innerHTML = "";
    };
  }, [highlights, language, spec.fn, spec.kind, spec.xDomain, spec.yDomain]);

  if (engine === "fallback") {
    return (
      <div>
        <p className="studio-engine-tag muted">{pickText(STUDIO_UI.fallbackPlot, language)}</p>
        <FunctionGraph spec={spec} highlights={highlights} language={language} progress={progress} />
      </div>
    );
  }

  return (
    <div className="studio-graph studio-desmos">
      <div className="studio-graph-head">
        <strong>{spec.title ? pickText(spec.title, language) : spec.fn}</strong>
        <span className="studio-engine-tag">{pickText(STUDIO_UI.desmos, language)}</span>
      </div>
      <div ref={hostRef} className="studio-desmos-host" />
    </div>
  );
}
