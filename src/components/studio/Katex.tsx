"use client";

import katex from "katex";
import { useMemo } from "react";
import "katex/dist/katex.min.css";

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
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        strict: "ignore",
        trust: false,
      });
    } catch {
      return tex;
    }
  }, [tex, display]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
