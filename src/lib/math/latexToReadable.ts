/**
 * LaTeX (Lebanese / Word-Equation style) → readable plain text for channels that
 * cannot render KaTeX (WhatsApp text, the simple Helvetica PDF).
 * Dependency-free (unit-tested).
 *
 * unicode mode: x² · √(x) · (a)/(b) · lim_{x→+∞} · ℝ   (WhatsApp)
 * ascii mode:   x^2 · sqrt(x) · (a)/(b) · lim_(x->+inf) · R (PDF with standard fonts)
 */

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", x: "ˣ", i: "ⁱ",
};

const SYMBOLS_UNICODE: Array<[RegExp, string]> = [
  [/\\infty/g, "∞"], [/\\to\b/g, "→"], [/\\rightarrow\b/g, "→"], [/\\Rightarrow\b/g, "⇒"],
  [/\\Leftrightarrow\b/g, "⇔"], [/\\leq?\b/g, "≤"], [/\\geq?\b/g, "≥"], [/\\neq?\b/g, "≠"],
  [/\\approx\b/g, "≈"], [/\\times\b/g, "×"], [/\\cdot\b/g, "·"], [/\\div\b/g, "÷"], [/\\pm\b/g, "±"],
  [/\\in\b/g, "∈"], [/\\notin\b/g, "∉"], [/\\cup\b/g, "∪"], [/\\cap\b/g, "∩"], [/\\subset\b/g, "⊂"],
  [/\\emptyset\b|\\varnothing\b/g, "∅"], [/\\forall\b/g, "∀"], [/\\exists\b/g, "∃"],
  [/\\mathbb\{R\}/g, "ℝ"], [/\\mathbb\{N\}/g, "ℕ"], [/\\mathbb\{Z\}/g, "ℤ"], [/\\mathbb\{Q\}/g, "ℚ"], [/\\mathbb\{C\}/g, "ℂ"],
  [/\\pi\b/g, "π"], [/\\alpha\b/g, "α"], [/\\beta\b/g, "β"], [/\\theta\b/g, "θ"], [/\\lambda\b/g, "λ"],
  [/\\Delta\b/g, "Δ"], [/\\delta\b/g, "δ"], [/\\sigma\b/g, "σ"], [/\\mu\b/g, "μ"], [/\\omega\b/g, "ω"],
  [/\\int\b/g, "∫"], [/\\sum\b/g, "∑"], [/\\prod\b/g, "∏"], [/\\degree\b|\^\{\\circ\}|\^\\circ/g, "°"],
];

const SYMBOLS_ASCII: Array<[RegExp, string]> = [
  [/\\infty/g, "inf"], [/\\to\b/g, "->"], [/\\rightarrow\b/g, "->"], [/\\Rightarrow\b/g, "=>"],
  [/\\Leftrightarrow\b/g, "<=>"], [/\\leq?\b/g, "<="], [/\\geq?\b/g, ">="], [/\\neq?\b/g, "!="],
  [/\\approx\b/g, "~"], [/\\times\b/g, "x"], [/\\cdot\b/g, "*"], [/\\div\b/g, "/"], [/\\pm\b/g, "+/-"],
  [/\\in\b/g, " in "], [/\\notin\b/g, " not in "], [/\\cup\b/g, " U "], [/\\cap\b/g, " n "], [/\\subset\b/g, " c "],
  [/\\emptyset\b|\\varnothing\b/g, "{}"], [/\\forall\b/g, "for all "], [/\\exists\b/g, "exists "],
  [/\\mathbb\{R\}/g, "R"], [/\\mathbb\{N\}/g, "N"], [/\\mathbb\{Z\}/g, "Z"], [/\\mathbb\{Q\}/g, "Q"], [/\\mathbb\{C\}/g, "C"],
  [/\\pi\b/g, "pi"], [/\\alpha\b/g, "alpha"], [/\\beta\b/g, "beta"], [/\\theta\b/g, "theta"], [/\\lambda\b/g, "lambda"],
  [/\\Delta\b/g, "Delta"], [/\\delta\b/g, "delta"], [/\\sigma\b/g, "sigma"], [/\\mu\b/g, "mu"], [/\\omega\b/g, "omega"],
  [/\\int\b/g, "integral"], [/\\sum\b/g, "sum"], [/\\prod\b/g, "prod"], [/\\degree\b|\^\{\\circ\}|\^\\circ/g, " deg"],
];

/** Index of the brace closing the one at `open` (or -1). */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === "{") depth += 1;
    else if (s[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Replace `\cmd{a}{b}` (arity 1 or 2) using `render`, innermost-safe via repeated passes. */
function replaceCommand(s: string, cmd: string, arity: 1 | 2, render: (args: string[]) => string): string {
  let out = s;
  for (let guard = 0; guard < 50; guard += 1) {
    const at = out.indexOf(`\\${cmd}{`);
    if (at < 0) break;
    const args: string[] = [];
    let cursor = at + cmd.length + 1;
    let failed = false;
    for (let k = 0; k < arity; k += 1) {
      while (out[cursor] === " ") cursor += 1;
      if (out[cursor] !== "{") { failed = true; break; }
      const close = matchBrace(out, cursor);
      if (close < 0) { failed = true; break; }
      args.push(out.slice(cursor + 1, close));
      cursor = close + 1;
    }
    if (failed) break;
    out = out.slice(0, at) + render(args) + out.slice(cursor);
  }
  return out;
}

function wrapIfComplex(s: string): string {
  const t = s.trim();
  // Single number / single symbol stays bare; anything longer (e.g. "2a") gets parentheses.
  if (/^(\d+(\.\d+)?|[A-Za-z]|∞|π|inf|pi)$/.test(t)) return t;
  return /^\([^()]*\)$/.test(t) ? t : `(${t})`;
}

const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋",
};

function toSubscript(s: string): string | null {
  const chars = [...s.trim()];
  if (!chars.length) return null;
  const mapped = chars.map((c) => SUBSCRIPT[c]);
  return mapped.every(Boolean) ? mapped.join("") : null;
}

function subscriptOf(sub: string, ascii: boolean): string {
  const t = sub.trim();
  if (ascii) return /^[A-Za-z0-9]$/.test(t) ? `_${t}` : `_(${t})`;
  return toSubscript(t) ?? `_(${t})`;
}

function toSuperscript(s: string): string | null {
  const chars = [...s.trim()];
  if (!chars.length) return null;
  const mapped = chars.map((c) => SUPERSCRIPT[c]);
  return mapped.every(Boolean) ? mapped.join("") : null;
}

export function latexToReadable(tex: string, options?: { ascii?: boolean }): string {
  const ascii = Boolean(options?.ascii);
  let s = (tex || "").trim();
  if (!s) return "";
  s = s.replace(/^\$+|\$+$/g, "").replace(/\\\(|\\\)|\\\[|\\\]/g, "");
  // Literal set braces \{ \} survive the final brace strip via placeholders.
  s = s.replace(/\\\{/g, "\u0001").replace(/\\\}/g, "\u0002");
  s = s.replace(/\\left|\\right|\\displaystyle|\\limits|\\nolimits/g, "");
  s = s.replace(/\\qquad|\\quad/g, " ; ").replace(/\\[,;:!]|~/g, " ");
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|boxed)\{/g, "\\grp{");
  s = replaceCommand(s, "grp", 1, ([a]) => a!);
  s = replaceCommand(s, "dfrac", 2, ([a, b]) => `\\frac{${a}}{${b}}`);
  s = replaceCommand(s, "tfrac", 2, ([a, b]) => `\\frac{${a}}{${b}}`);
  for (const [re, rep] of ascii ? SYMBOLS_ASCII : SYMBOLS_UNICODE) s = s.replace(re, rep);
  // Fractions & roots after symbols so inner content is already readable.
  s = replaceCommand(s, "frac", 2, ([a, b]) => `${wrapIfComplex(a!)}/${wrapIfComplex(b!)}`);
  s = replaceCommand(s, "sqrt", 1, ([a]) => (ascii ? `sqrt(${a!.trim()})` : `√(${a!.trim()})`));
  s = s.replace(/\\lim/g, "lim").replace(/\\(ln|log|exp|sin|cos|tan|max|min)\b/g, "$1");
  // Subscripts: lim_{x→a} stays as _(...) for readability.
  s = s.replace(/_\{([^{}]*)\}/g, (_m, sub: string) => subscriptOf(sub, ascii));
  s = s.replace(/_([0-9])(?![0-9])/g, (_m, sub: string) => subscriptOf(sub, ascii));
  // Superscripts.
  s = s.replace(/\^\{([^{}]*)\}/g, (_m, sup: string) => {
    if (ascii) return /^[A-Za-z0-9]+$/.test(sup.trim()) ? `^${sup.trim()}` : `^(${sup.trim()})`;
    return toSuperscript(sup) ?? `^(${sup.trim()})`;
  });
  s = s.replace(/\^([A-Za-z0-9])/g, (_m, sup: string) => (ascii ? `^${sup}` : (SUPERSCRIPT[sup] ?? `^${sup}`)));
  s = s.replace(/\\\\/g, " ; ").replace(/&/g, " ");
  s = s.replace(/\\([A-Za-z]+)/g, "$1").replace(/[{}]/g, "");
  // Stray backslashes (e.g. before Arabic text) carry no meaning in plain text.
  s = s.replace(/\\/g, "");
  s = s.replace(/\u0001/g, "{").replace(/\u0002/g, "}");
  return s.replace(/[ \t]{2,}/g, " ").trim();
}

const UNICODE_TO_ASCII: Array<[RegExp, string]> = [
  [/[“”«»]/g, '"'], [/[‘’]/g, "'"], [/[—–−]/g, "-"], [/…/g, "..."], [/×/g, "x"], [/÷/g, "/"],
  [/≤/g, "<="], [/≥/g, ">="], [/≠/g, "!="], [/→/g, "->"], [/∞/g, "inf"], [/√/g, "sqrt"], [/π/g, "pi"],
  [/Δ/g, "Delta"], [/ℝ/g, "R"], [/²/g, "^2"], [/³/g, "^3"], [/·/g, "*"], [/°/g, " deg"], [/\u00a0/g, " "],
  [/[′ʼ]/g, "'"], [/″/g, "''"], [/θ/g, "theta"], [/α/g, "alpha"], [/β/g, "beta"], [/λ/g, "lambda"],
  [/∩/g, " n "], [/∪/g, " U "], [/∈/g, " in "], [/±/g, "+/-"], [/≈/g, "~"],
];

/**
 * Prose with inline `$…$` LaTeX and Unicode math → Latin-1-safe text for the simple PDF
 * (Helvetica, no embedded font). Remaining non-ASCII characters are dropped.
 */
export function asciiForPdf(text: string): string {
  let s = (text || "").replace(/\$([^$]{1,400})\$/g, (_m, inner: string) => latexToReadable(inner, { ascii: true }));
  if (/\\[A-Za-z]|\^\{|_\{/.test(s)) s = latexToReadable(s, { ascii: true });
  for (const [re, rep] of UNICODE_TO_ASCII) s = s.replace(re, rep);
  return s.replace(/[^\x20-\x7E]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}
