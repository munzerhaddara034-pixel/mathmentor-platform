/** Split prose into text / TeX pieces (delimited `$…$`, `\(…\)`, and bare `x^2`, `\frac…`, `3/4` islands). */
export type MathPiece = { tex?: string; text?: string; display?: boolean };

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
  out: MathPiece[],
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

export function piecesOf(text: string): MathPiece[] {
  const out: MathPiece[] = [];
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

