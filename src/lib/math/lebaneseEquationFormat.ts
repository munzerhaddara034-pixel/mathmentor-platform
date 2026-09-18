/**
 * Lebanese / Word “Insert Equation” formatting layer.
 *
 * Student-facing math (canvas, solver sheet, quizzes) must look like an official
 * booklet: stacked fractions, true superscripts, radical signs, limits under the
 * operator, integral bounds above/below.
 *
 * Never Al-Tarah / الطارة. Instructor: Prof. Munzer Haddara / الأستاذ منذر حداره.
 */

export const LEBANESE_EQUATION_STANDARD = {
  fractions: "\\frac{a}{b}",
  superscripts: "x^{n}",
  radicals: "\\sqrt{...}",
  limits: "\\lim\\limits_{x \\to a}",
  integrals: "\\int\\limits_{a}^{b}",
} as const;

const LATEX_FIELD_KEYS = new Set([
  "latex",
  "math_latex",
  "finalAnswerLatex",
  "latexDraft",
]);

/** End of an Arabic/Latin math token (JS `\\b` does not work after Arabic letters). */
const TOKEN_END = String.raw`(?![A-Za-z0-9\u0600-\u06FF])`;

/** Spoken Arabic / English → official LaTeX (before the solver / canvas). */
const SPOKEN_TO_LATEX: Array<[RegExp, string]> = [
  [/إكس\s*سكوير|اكس\s*سكوير|أكس\s*سكوير/gi, "x^{2}"],
  [/واي\s*سكوير|y\s*square(?:d)?/gi, "y^{2}"],
  [/إكس\s*مربع|اكس\s*مربع|إكس\s*تربيع|اكس\s*تربيع/gi, "x^{2}"],
  [/إكس\s*مكعب|اكس\s*مكعب/gi, "x^{3}"],
  [/x\s*squared|x\s*square(?!d)/gi, "x^{2}"],
  [/x\s*cubed/gi, "x^{3}"],
  [new RegExp(String.raw`واحد\s+على\s+(?:ال)?(?:إكس|اكس|x)${TOKEN_END}`, "gi"), "\\frac{1}{x}"],
  [/one\s+over\s+x\b|1\s+over\s+x\b/gi, "\\frac{1}{x}"],
  [/اثن(?:ين|ان)\s+على\s+ثلاثة/gi, "\\frac{2}{3}"],
  [/ثلاثة\s+على\s+أربعة|ثلاثة\s+على\s+اربعة/gi, "\\frac{3}{4}"],
  [new RegExp(String.raw`جذر\s*(?:تربيعي\s*(?:ل|لـ)?)?\s*(?:إكس|اكس|x)${TOKEN_END}`, "gi"), "\\sqrt{x}"],
  [/square\s*root\s*(?:of\s*)?x\b/gi, "\\sqrt{x}"],
  [/نهاية\s*عند\s*(?:ال)?زائد\s*(?:انفينيتي|إنفينيتي|ما لا نهاية)/gi, "\\lim\\limits_{x \\to +\\infty}"],
  [/نهاية\s*عند\s*(?:ال)?ناقص\s*(?:انفينيتي|إنفينيتي|ما لا نهاية)/gi, "\\lim\\limits_{x \\to -\\infty}"],
  [/limit\s*(?:as\s*x\s*(?:goes|tends)\s*to\s*)?(?:plus\s*)?infinity/gi, "\\lim\\limits_{x \\to +\\infty}"],
  [/limit\s*(?:as\s*x\s*(?:goes|tends)\s*to\s*)?minus\s*infinity/gi, "\\lim\\limits_{x \\to -\\infty}"],
  [/ديريفاتيف|إف\s*فتحة|اف\s*فتحة/gi, "f'(x)"],
  [/f\s*prime(?:\s*of\s*x)?/gi, "f'(x)"],
];

const ATOM = String.raw`(?:\\[A-Za-z]+(?:\[[^\]]*\])?(?:\{[^{}]*\})*|[A-Za-z0-9]+(?:_\{[^{}]*\}|_[A-Za-z0-9]+|\^\{[^{}]*\}|\^[A-Za-z0-9]+)*|\([^()]{1,120}\)|\|[^\|]{1,80}\|)`;

function protectSegments(tex: string, pattern: RegExp): { text: string; slots: string[] } {
  const slots: string[] = [];
  const text = tex.replace(pattern, (match) => {
    const i = slots.length;
    slots.push(match);
    return `@@MM${i}@@`;
  });
  return { text, slots };
}

function restoreSegments(tex: string, slots: string[]) {
  return tex.replace(/@@MM(\d+)@@/g, (_, n: string) => slots[Number(n)] ?? "");
}

function stripOuterParens(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    let depth = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") {
        depth -= 1;
        if (depth === 0 && i < trimmed.length - 1) return trimmed;
      }
    }
    if (depth === 0) return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function convertSlashFractions(tex: string) {
  const protectedFrac = protectSegments(
    tex,
    /\\(?:d|t)?frac\s*\{[^{}]*\}\s*\{[^{}]*\}|https?:\/\/\S+/g,
  );
  let next = protectedFrac.text;
  const pair = new RegExp(`(${ATOM})\\s*/\\s*(${ATOM})`, "g");
  for (let i = 0; i < 8; i++) {
    const before = next;
    next = next.replace(pair, (_, a: string, b: string) => `\\frac{${stripOuterParens(a)}}{${stripOuterParens(b)}}`);
    if (next === before) break;
  }
  next = next.replace(
    new RegExp(String.raw`(\\(?:sin|cos|tan|ln|log|cot|sec|csc)\s*[A-Za-z0-9]+)\s*/\s*(${ATOM})`, "g"),
    (_m, num: string, den: string) => `\\frac{${num}}{${stripOuterParens(den)}}`,
  );
  return restoreSegments(next, protectedFrac.slots);
}

function braceSuperscripts(tex: string) {
  return tex
    .replace(/\^\{([^{}]*)\}/g, "^@@B$1@@")
    .replace(/\^(-?\d+|[A-Za-z]|\\[A-Za-z]+(?:\{[^{}]*\})?|\([^()]+\))/g, "^{$1}")
    .replace(/\^@@B([^{}]*?)@@/g, "^{$1}");
}

function convertSqrts(tex: string) {
  return tex
    .replace(/\\sqrt\s*\(([^)]+)\)/g, "\\sqrt{$1}")
    .replace(/(?<![\\A-Za-z])sqrt\s*\(([^)]+)\)/gi, "\\sqrt{$1}")
    .replace(/(?<![\\A-Za-z])sqrt\s*\{([^{}]+)\}/gi, "\\sqrt{$1}")
    .replace(/(?<![\\A-Za-z])sqrt\s+([A-Za-z0-9]+)/gi, "\\sqrt{$1}")
    .replace(/√\s*\(?\s*([A-Za-z0-9+\-]+)\s*\)?/g, "\\sqrt{$1}");
}

function convertUnicodeMiniMath(tex: string) {
  return tex
    .replace(/²/g, "^{2}")
    .replace(/³/g, "^{3}")
    .replace(/∞/g, "\\infty")
    .replace(/±/g, "\\pm")
    .replace(/→/g, "\\to")
    .replace(/×/g, "\\times");
}

function braceBound(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  return `{${trimmed}}`;
}

function convertLimitsAndIntegrals(tex: string) {
  let next = tex
    .replace(/(?<![\\A-Za-z])lim\s*_/g, "\\lim_")
    .replace(/(?<![\\A-Za-z])lim\s*\(/g, "\\lim(")
    .replace(
      /(?<![\\A-Za-z])lim\s*x\s*(?:->|\\to|→)\s*(\+?-?\\?infty|\+?-?inf(?:inity)?|[^\s,;]+)/gi,
      (_m, dest: string) => {
        let to = dest.replace(/infinity/gi, "\\infty").replace(/\binf\b/gi, "\\infty");
        if (!to.startsWith("\\") && to.includes("infty") && !to.includes("\\infty")) to = to.replace(/infty/g, "\\infty");
        return `\\lim\\limits_{x \\to ${to}}`;
      },
    )
    .replace(/\\to\s*\+?inf(?!ty|inity)/gi, "\\to +\\infty")
    .replace(/\\to\s*-inf(?!ty|inity)/gi, "\\to -\\infty");

  next = next.replace(/\\lim(?!sup|inf)(?:\s*\\limits)?\s*_/g, "\\lim\\limits_");
  next = next.replace(/\\int(?:\s*\\limits)?\s*_/g, "\\int\\limits_");
  next = next.replace(/\\sum(?:\s*\\limits)?\s*_/g, "\\sum\\limits_");
  next = next.replace(
    /\\int\\limits_(\{[^}]+\}|[A-Za-z0-9]+)\s*\^(\{[^}]+\}|[A-Za-z0-9]+)/g,
    (_m, a: string, b: string) => `\\int\\limits_${braceBound(a)}^${braceBound(b)}`,
  );
  next = next.replace(/\\lim\\limits_([A-Za-z0-9]+)/g, "\\lim\\limits_{$1}");
  next = next.replace(/\\sum\\limits_([A-Za-z0-9]+)/g, "\\sum\\limits_{$1}");
  return next;
}

function applySpokenReplacements(text: string) {
  let next = text;
  for (const [pattern, replacement] of SPOKEN_TO_LATEX) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

/**
 * Convert a Whisper / demo spoken transcript into official LaTeX fragments
 * (`إكس سكوير` → `x^{2}`, `واحد على إكس` → `\frac{1}{x}`).
 */
export function spokenMathToLebaneseLatex(spoken: string) {
  return formatLebaneseEquation(applySpokenReplacements(spoken));
}

/**
 * Rewrite a LaTeX (or pseudo-LaTeX) string to Lebanese booklet / Word Equation form.
 * Safe to run more than once.
 */
export function formatLebaneseEquation(input: string) {
  if (!input) return input;
  let tex = convertUnicodeMiniMath(input);
  const textBits = protectSegments(tex, /\\text\s*\{[^{}]*\}/g);
  tex = textBits.text;
  tex = applySpokenReplacements(tex);
  tex = convertSqrts(tex);
  tex = braceSuperscripts(tex);
  tex = convertSlashFractions(tex);
  tex = convertLimitsAndIntegrals(tex);
  tex = restoreSegments(tex, textBits.slots);
  return tex;
}

/** True when the string still has a student-visible slash fraction, unbraced caret, or `sqrt`. */
export function hasForbiddenEquationForm(tex: string) {
  const stripped = protectSegments(tex, /\\text\s*\{[^{}]*\}|https?:\/\/\S+/g).text;
  if (/(?<![\\A-Za-z])sqrt\b/i.test(stripped)) return true;
  const withoutFrac = stripped.replace(/\\(?:d|t)?frac\s*\{[^{}]*\}\s*\{[^{}]*\}/g, "F");
  if (/(?<!:)(?<!\\)\//.test(withoutFrac)) return true;
  const withoutBraced = stripped.replace(/\^\{[^{}]*\}/g, "^B");
  if (/\^[^{B\s]/.test(withoutBraced.replace(/\\\^/g, ""))) return true;
  return false;
}

export function formatLatexFields<T>(value: T): T {
  return walkLatexFields(value) as T;
}

function walkLatexFields(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key && LATEX_FIELD_KEYS.has(key)) return formatLebaneseEquation(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => walkLatexFields(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walkLatexFields(v, k);
    }
    return out;
  }
  return value;
}
