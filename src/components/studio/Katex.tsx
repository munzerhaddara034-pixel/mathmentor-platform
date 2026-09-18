"use client";

import katex from "katex";
import { useMemo } from "react";
import "katex/dist/katex.min.css";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";

/** npm KaTeX (`renderToString`) — SSR-safe. Optional CDN: katex@0.16.8 on jsDelivr. */
export function Katex({
  tex,
  display = false,
  className,
}: {
  tex: string;
  display?: boolean;
  className?: string;
}) {
  const html = useMemo(() => {
    const cleaned = formatLebaneseEquation(tex);
    try {
      return katex.renderToString(cleaned, {
        displayMode: display,
        throwOnError: false,
        strict: "ignore",
        trust: false,
      });
    } catch {
      return cleaned;
    }
  }, [tex, display]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
