"use client";

import { useEffect } from "react";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";

declare global {
  interface Window {
    MathJax?: { typesetPromise?: () => Promise<unknown> };
  }
}

export function MathTex({ tex, inline }: { tex?: string; inline?: boolean }) {
  const cleaned = tex ? formatLebaneseEquation(tex) : tex;
  useEffect(() => {
    void window.MathJax?.typesetPromise?.();
  }, [cleaned]);
  if (!cleaned) return null;
  return inline ? <span>{`\\(${cleaned}\\)`}</span> : <div className="math-block">{`\\[${cleaned}\\]`}</div>;
}
