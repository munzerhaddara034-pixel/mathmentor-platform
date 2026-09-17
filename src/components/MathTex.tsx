"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    MathJax?: { typesetPromise?: () => Promise<unknown> };
  }
}

export function MathTex({ tex, inline }: { tex?: string; inline?: boolean }) {
  useEffect(() => {
    void window.MathJax?.typesetPromise?.();
  }, [tex]);
  if (!tex) return null;
  return inline ? <span>{`\\(${tex}\\)`}</span> : <div className="math-block">{`\\[${tex}\\]`}</div>;
}
