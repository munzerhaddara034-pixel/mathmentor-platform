import katex from "katex";
import "katex/dist/katex.min.css";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";

/**
 * Server-only KaTeX (RSC): renders to HTML at request time, so pages that use it ship no KaTeX JS
 * and have no layout shift. Same Lebanese Word-Equation formatting as the client <Katex>.
 */
export function MathServer({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const cleaned = formatLebaneseEquation(tex);
  let html: string;
  try {
    html = katex.renderToString(cleaned, { displayMode: display, throwOnError: false, strict: "ignore", trust: false });
  } catch {
    html = cleaned.replace(/[&<>]/g, (ch) => (ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : "&gt;"));
  }
  return (
    <span
      dir="ltr"
      className={`mm-math${className ? ` ${className}` : ""}`}
      style={{ unicodeBidi: "isolate" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
