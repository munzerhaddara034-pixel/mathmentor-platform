import { Katex } from "@/components/studio/Katex";

/**
 * Student-visible math: always KaTeX in Lebanese "Word Equation" form (via formatLebaneseEquation
 * inside Katex): no slash fractions and no raw carets. Rendered LTR and bidi-isolated.
 */
export function MathInline({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  return <Katex tex={tex} display={display} className={`mm-math${className ? ` ${className}` : ""}`} />;
}
