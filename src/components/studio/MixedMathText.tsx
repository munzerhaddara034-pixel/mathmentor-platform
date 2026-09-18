"use client";

import { Katex } from "@/components/studio/Katex";

const DELIMITED = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

const BARE_MATH =
  /(\\(?:frac|dfrac|tfrac|sqrt|lim(?:\\limits)?|int(?:\\limits)?|sum(?:\\limits)?|binom|log|ln|sin|cos|tan)(?:_[A-Za-z0-9]+|\_\{[^{}]+\})?(?:\^[A-Za-z0-9]+|\^\{[^{}]+\})?(?:\{[^{}]*\}){0,2}|(?:[A-Za-z](?:_[A-Za-z0-9]+|_\{[^{}]+\})?\^(?:\{[^{}]+\}|[A-Za-z0-9]+))|(?:(?<![A-Za-z:])\d+\/\d+))/g;

function unwrapDelimited(chunk: string): { tex: string; display: boolean } | null {
  const t = chunk.trim();
  if (t.startsWith("$$") && t.endsWith("$$") && t.length > 4) {
    return { tex: t.slice(2, -2).trim(), display: true };
  }
  if (t.startsWith("\\[") && t.endsWith("\\]") && t.length > 4) {
    return { tex: t.slice(2, -2).trim(), display: true };
  }
  if (t.startsWith("\\(") && t.endsWith("\\)") && t.length > 4) {
    return { tex: t.slice(2, -2).trim(), display: false };
  }
  if (t.startsWith("$") && t.endsWith("$") && t.length > 2) {
    return { tex: t.slice(1, -1).trim(), display: false };
  }
  return null;
}

function pushBareMath(
  text: string,
  out: Array<{ tex?: string; text?: string; display?: boolean }>,
) {
  if (!text) return;
  const re = new RegExp(BARE_MATH.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) out.push({ text: text.slice(last, match.index) });
    out.push({ tex: match[0], display: false });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
}

function piecesOf(text: string): Array<{ tex?: string; text?: string; display?: boolean }> {
  const out: Array<{ tex?: string; text?: string; display?: boolean }> = [];
  const re = new RegExp(DELIMITED.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    pushBareMath(text.slice(last, match.index), out);
    const unwrapped = unwrapDelimited(match[0]);
    if (unwrapped) out.push(unwrapped);
    else out.push({ text: match[0] });
    last = match.index + match[0].length;
  }
  pushBareMath(text.slice(last), out);
  return out;
}

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
