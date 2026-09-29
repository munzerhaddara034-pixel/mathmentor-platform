/**
 * Spoken Arabic / English math → official Lebanese / Word Insert Equation LaTeX.
 * Used by the demo parser and as a hint for the LLM step.
 * The Voice-to-Math cleaning layer (`src/lib/math/lebaneseEquationFormat.ts`) is the
 * source of truth before the live canvas:
 *   «إكس سكوير» → x^{2} (renders as a superscript, never a visible caret)
 *   «واحد على إكس» → \frac{1}{x} (never 1/x)
 *   «جذر إكس» → \sqrt{x} (never the letters sqrt)
 *   «نهاية عند الزائد إنفينيتي» → \lim\limits_{x \to +\infty}
 *   «ديريفاتيف» → f'(x)
 */

export type SpokenLatexHint = {
  pattern: RegExp;
  latex: string;
  spoken: string;
};

export const SPOKEN_LATEX_HINTS: SpokenLatexHint[] = [
  { pattern: /اكس\s*مربع|إكس\s*مربع|اكس\s*تربيع|إكس\s*تربيع|إكس\s*سكوير|اكس\s*سكوير|x\s*squared|x\s*square/gi, latex: "x^{2}", spoken: "إكس سكوير" },
  { pattern: /واحد\s+على\s+(?:إكس|اكس|x)|one\s+over\s+x/gi, latex: "\\frac{1}{x}", spoken: "واحد على إكس" },
  { pattern: /جذر\s*(?:تربيعي\s*(?:ل|لـ)?)?\s*(?:إكس|اكس|x)|square\s*root\s*(?:of\s*)?x/gi, latex: "\\sqrt{x}", spoken: "جذر إكس" },
  { pattern: /اكس\s*مكعب|إكس\s*مكعب|x\s*cubed/gi, latex: "x^{3}", spoken: "إكس مكعب" },
  {
    pattern: /نهاية\s*عند\s*(?:ال)?زائد\s*(?:انفينيتي|إنفينيتي|ما لا نهاية)|limit\s*(?:as\s*x\s*(?:goes|tends)\s*to\s*)?(?:plus\s*)?infinity/gi,
    latex: "\\lim\\limits_{x \\to +\\infty}",
    spoken: "نهاية عند الزائد إنفينيتي",
  },
  {
    pattern: /نهاية\s*عند\s*(?:ال)?ناقص\s*(?:انفينيتي|إنفينيتي|ما لا نهاية)|limit\s*(?:as\s*x\s*(?:goes|tends)\s*to\s*)?minus\s*infinity/gi,
    latex: "\\lim\\limits_{x \\to -\\infty}",
    spoken: "نهاية عند الناقص إنفينيتي",
  },
  { pattern: /ديريفاتيف|المشتق(?:ة)?|derivative/gi, latex: "f'(x)", spoken: "ديريفاتيف" },
  { pattern: /إف\s*فتحة|اف\s*فتحة|f\s*prime/gi, latex: "f'(x)", spoken: "إف فتحة" },
  { pattern: /مجموعة\s*(?:ال)?تعريف|ensemble\s*de\s*d[eé]finition|domain/gi, latex: "D_f", spoken: "مجموعة التعريف" },
  { pattern: /ما\s*لا\s*نهاية|انفينيتي|إنفينيتي|infinity/gi, latex: "\\infty", spoken: "إنفينيتي" },
  { pattern: /الجذر\s*التربيعي|square\s*root/gi, latex: "\\sqrt{}", spoken: "الجذر التربيعي" },
  { pattern: /تكامل|integral/gi, latex: "\\int", spoken: "تكامل" },
  { pattern: /لوغاريتم|لن|natural\s*log/gi, latex: "\\ln", spoken: "لوغاريتم" },
];

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/إكس مربع|اكس مربع|إكس تربيع|اكس تربيع|إكس سكوير|اكس سكوير/gi, "x^{2}"],
  [/واحد على إكس|واحد على اكس/gi, "1/x"],
  [/جذر إكس|جذر اكس/gi, "sqrt(x)"],
  [/إكس مكعب|اكس مكعب/gi, "x^{3}"],
  [/واي مربع|واي تربيع/gi, "y^{2}"],
  [/إف إكس|اف إكس|إف اكس|اف اكس/gi, "f(x)"],
  [/جي إكس|جي اكس/gi, "g(x)"],
  [/إي أس إكس|اي اس اكس|e to the x/gi, "e^x"],
  [/إف فتحة(?:\s*إكس)?|اف فتحة(?:\s*اكس)?/gi, "f'(x)"],
  [/ديريفاتيف/gi, "f'(x)"],
  [/المشتقة|المشتق/gi, "f'(x)"],
  [/نهاية عند الزائد إنفينيتي|نهاية عند الزائد انفينيتي|نهاية عند زائد ما لا نهاية/gi, "lim x->+inf"],
  [/نهاية عند الناقص إنفينيتي|نهاية عند الناقص انفينيتي|نهاية عند ناقص ما لا نهاية/gi, "lim x->-inf"],
  [/نهاية عندما إكس يؤول إلى|نهاية عندما اكس يؤول الى/gi, "lim x->"],
  [/نهاية/gi, "limit"],
  [/ما لا نهاية|إنفينيتي|انفينيتي/gi, "infinity"],
  [/زائد/gi, "plus"],
  [/ناقص/gi, "minus"],
  [/ضرب/gi, "times"],
  [/تقسيم/gi, "over"],
  [/يساوي|تساوي/gi, "equals"],
  [/مجموعة التعريف/gi, "domain D_f"],
  [/جدول التغيرات|جدول التغير/gi, "table of variations"],
  [/مستقيم مقارب أفقي|مقارب أفقي/gi, "horizontal asymptote"],
  [/مستقيم مقارب عمودي|مقارب عمودي/gi, "vertical asymptote"],
  [/ادرس الدالة|دراسة الدالة/gi, "Study the function"],
  [/احسب|أحسب/gi, "Calculate"],
  [/بيّن أن|بين أن/gi, "Show that"],
  [/استنتج/gi, "Deduce"],
  [/x squared/gi, "x^{2}"],
  [/x cubed/gi, "x^{3}"],
  [/one over x|1 over x/gi, "1/x"],
  [/f of x/gi, "f(x)"],
  [/f prime(?: of x)?/gi, "f'(x)"],
  [/limit as x (?:goes|tends) to plus infinity/gi, "lim x->+inf"],
  [/limit as x (?:goes|tends) to minus infinity/gi, "lim x->-inf"],
  [/plus infinity/gi, "+inf"],
  [/minus infinity/gi, "-inf"],
];

export function spokenMathToPlain(text: string) {
  let next = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next.replace(/\s+/g, " ").trim();
}

export function extractLatexHints(text: string): Array<{ spoken: string; latex: string }> {
  const found: Array<{ spoken: string; latex: string }> = [];
  const seen = new Set<string>();
  for (const hint of SPOKEN_LATEX_HINTS) {
    hint.pattern.lastIndex = 0;
    if (hint.pattern.test(text) && !seen.has(hint.latex)) {
      seen.add(hint.latex);
      found.push({ spoken: hint.spoken, latex: hint.latex });
    }
  }
  return found;
}

export function latexStepsFromHints(text: string): Array<{ latex: string; spoken: string }> {
  return extractLatexHints(text);
}
