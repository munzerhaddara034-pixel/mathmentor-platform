"use client";

import { Katex } from "@/components/studio/Katex";

const MATH_CHUNK =
  /(\\(?:frac\{[^{}]+\}\{[^{}]+\}|sqrt\{[^{}]+\}|lim(?:\\limits)?_\{[^{}]+\}|[A-Za-z]+)|[A-Za-z](?:_\{[^{}]+\}|_[A-Za-z0-9]+)?\^\{[^{}]+\}|[A-Za-z]\^[A-Za-z0-9]+)/g;

function isMathChunk(piece: string) {
  return (
    /\\frac\{|\\sqrt\{|\\lim/.test(piece) ||
    /\^[A-Za-z0-9{]/.test(piece)
  );
}

/**
 * Headings may mix prose with official LaTeX. Render math chunks with KaTeX so
 * students never see a slash fraction, a caret, or the letters sqrt.
 */
export function MixedMathText({
  text,
  as: Tag = "span",
}: {
  text: string;
  as?: "span" | "h1" | "h2" | "p";
}) {
  const pieces = text.split(MATH_CHUNK);
  return (
    <Tag>
      {pieces.map((piece, index) =>
        piece && isMathChunk(piece) ? (
          <Katex key={`${piece}-${index}`} tex={piece} />
        ) : (
          <span key={`${piece}-${index}`}>{piece}</span>
        ),
      )}
    </Tag>
  );
}
