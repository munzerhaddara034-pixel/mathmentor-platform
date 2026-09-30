import type { ReactNode } from "react";

/**
 * Bidi isolation helper: wrap any left-to-right run (Latin words, numbers with units, codes,
 * paths, prices, times) that sits inside Arabic RTL text so punctuation and order never flip.
 * `<Ltr>45 min</Ltr>` stays "45 min" instead of rendering as "min 45".
 */
export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}

/** Same as {@link Ltr} for block-level LTR content (English paragraphs, code samples). */
export function LtrBlock({ children, className, lang = "en" }: { children: ReactNode; className?: string; lang?: string }) {
  return (
    <div dir="ltr" lang={lang} className={className} style={{ unicodeBidi: "isolate", textAlign: "left" }}>
      {children}
    </div>
  );
}
