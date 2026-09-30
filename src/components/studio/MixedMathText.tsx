"use client";

import { Katex } from "@/components/studio/Katex";
import { piecesOf } from "@/lib/math/mixedMath";

/**
 * Headings and question-bank prose may mix text with official LaTeX.
 * Math islands render through KaTeX (which runs `formatLebaneseEquation`)
 * so students never see a slash fraction, a caret, or the letters sqrt.
 */
export function MixedMathText({
  text,
  as: Tag = "span",
}: {
  text: string;
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "p";
}) {
  const pieces = piecesOf(text);
  return (
    <Tag>
      {pieces.map((piece, index) =>
        piece.tex ? (
          <Katex key={`${piece.tex}-${index}`} tex={piece.tex} display={piece.display} />
        ) : (
          <span key={`${piece.text}-${index}`}>{piece.text}</span>
        ),
      )}
    </Tag>
  );
}
