"use client";

import { Katex } from "@/components/studio/Katex";

declare global {
  interface Window {
    MathJax?: { typesetPromise?: () => Promise<unknown> };
  }
}

/**
 * Legacy API kept for LessonNotes / QuizEngine. redesign-v2 renders it with KaTeX (Lebanese Word-Equation
 * formatting via <Katex>) instead of loading MathJax 3 from a CDN on every page.
 */
export function MathTex({ tex, inline }: { tex?: string; inline?: boolean }) {
  if (!tex) return null;
  return inline ? <Katex tex={tex} className="mm-math" /> : <div className="math-block"><Katex tex={tex} display className="mm-math" /></div>;
}
