/**
 * Lebanese / Word Insert Equation formatting layer.
 * Run: npx tsx scripts/verify-lebanese-equation-format.ts
 */
import {
  formatLebaneseEquation,
  formatLatexFields,
  hasForbiddenEquationForm,
  spokenMathToLebaneseLatex,
} from "../src/lib/math/lebaneseEquationFormat";
import { DEMO_DICTATION_AR, DEMO_DICTATION_FRAC_AR, demoParseTranscript } from "../src/lib/voiceMath/demo";
import { extractLatexHints } from "../src/lib/voiceMath/phrases";
import { FORBIDDEN_NAME_AR, FORBIDDEN_NAME_EN, INSTRUCTOR_AR, INSTRUCTOR_EN } from "../src/lib/pedagogy/lebanese";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main() {
  const square = spokenMathToLebaneseLatex("إكس سكوير");
  assert(square.includes("x^{2}"), "إكس سكوير → x^{2}");
  assert(!hasForbiddenEquationForm(square), "إكس سكوير must not keep a visible caret");

  const frac = spokenMathToLebaneseLatex("واحد على إكس");
  assert(frac.includes("\\frac{1}{x}"), "واحد على إكس → \\frac{1}{x}");
  assert(!frac.includes("1/x"), "no slash fraction after cleaning");

  const radical = spokenMathToLebaneseLatex("جذر إكس");
  assert(radical.includes("\\sqrt{x}"), "جذر إكس → \\sqrt{x}");
  assert(!/(?<![\\A-Za-z])sqrt/i.test(radical), "no literal sqrt");

  const dictation = spokenMathToLebaneseLatex(DEMO_DICTATION_FRAC_AR);
  assert(dictation.includes("\\frac{1}{x}"), "frac-ar dictation has stacked 1/x");
  assert(dictation.includes("x^{2}"), "frac-ar dictation has x^{2}");
  assert(dictation.includes("\\sqrt{x}"), "frac-ar dictation has sqrt");
  assert(!hasForbiddenEquationForm(dictation), "frac-ar dictation is booklet-clean");
  assert(formatLebaneseEquation(dictation) === dictation, "spoken cleaning is idempotent");

  assert(formatLebaneseEquation("1/x").includes("\\frac{1}{x}"), "slash 1/x → frac");
  assert(formatLebaneseEquation("(x+1)/(x-1)").includes("\\frac{x+1}{x-1}"), "slash binomial → frac");
  assert(formatLebaneseEquation("x^2") === "x^{2}", "x^2 → x^{2}");
  assert(formatLebaneseEquation("x^10") === "x^{10}", "x^10 → x^{10}");
  assert(formatLebaneseEquation("sqrt(x)").includes("\\sqrt{x}"), "sqrt(x) → \\sqrt{x}");
  assert(formatLebaneseEquation("sqrt(2x+1)").includes("\\sqrt{2x+1}"), "sqrt(2x+1)");
  assert(!hasForbiddenEquationForm(formatLebaneseEquation("1/x")), "formatted 1/x is legal");
  assert(hasForbiddenEquationForm("1/x"), "raw 1/x is forbidden");
  assert(hasForbiddenEquationForm("x^2"), "raw x^2 is forbidden");
  assert(hasForbiddenEquationForm("sqrt(x)"), "raw sqrt(x) is forbidden");

  const lim = formatLebaneseEquation("lim x->+inf");
  assert(lim.includes("\\lim\\limits_"), "limits sit under the operator");
  assert(lim.includes("\\infty"), "infinity is \\infty");

  const spokenLim = spokenMathToLebaneseLatex("نهاية عند الزائد إنفينيتي");
  assert(spokenLim.includes("\\lim\\limits_{x \\to +\\infty}"), "Arabic limit → \\lim\\limits");

  const integral = formatLebaneseEquation("\\int_0^1");
  assert(integral.includes("\\int\\limits_{0}^{1}"), "integral bounds above/below");

  assert(formatLebaneseEquation("\\frac{1}{x}") === "\\frac{1}{x}", "frac is idempotent");
  assert(formatLebaneseEquation("x^{2}") === "x^{2}", "braced power is idempotent");
  assert(formatLebaneseEquation("\\sqrt{x}") === "\\sqrt{x}", "sqrt command is idempotent");

  const fields = formatLatexFields({
    latex: "1/x",
    fn: "1/x",
    graph: { fn: "Math.sqrt(x)/x" },
    payload: { math_latex: "x^2", latex: "sqrt(x)" },
  });
  assert(fields.latex.includes("\\frac{1}{x}"), "formatLatexFields cleans latex");
  assert(fields.fn === "1/x", "graph fn must stay a JS expression");
  assert(fields.graph.fn === "Math.sqrt(x)/x", "nested graph.fn is never frac/sqrt-rewritten");
  assert(fields.payload.math_latex === "x^{2}", "math_latex is cleaned");
  assert(fields.payload.latex.includes("\\sqrt{x}"), "nested latex is cleaned");

  const arabic = spokenMathToLebaneseLatex(DEMO_DICTATION_AR);
  assert(arabic.includes("x^{2}"), "quadratic dictation maps إكس مربع");
  assert(arabic.includes("\\lim\\limits_"), "quadratic dictation maps نهاية");
  assert(arabic.includes("f'(x)"), "quadratic dictation maps ديريفاتيف");

  const hints = extractLatexHints(DEMO_DICTATION_FRAC_AR);
  assert(
    hints.some((item) => item.latex === "\\frac{1}{x}"),
    "hint واحد على إكس",
  );
  assert(
    hints.some((item) => item.latex === "x^{2}"),
    "hint إكس سكوير",
  );
  assert(
    hints.some((item) => item.latex === "\\sqrt{x}"),
    "hint جذر إكس",
  );

  const parsed = demoParseTranscript(DEMO_DICTATION_FRAC_AR, "ar", "ls");
  const blob = JSON.stringify(parsed);
  assert(parsed.latexSteps.some((step) => step.latex.includes("\\frac{1}{x}")), "demo steps include stacked fraction");
  assert(parsed.latexSteps.some((step) => /x\^\{2\}/.test(step.latex)), "demo steps include x^{2}");
  assert(parsed.latexSteps.some((step) => step.latex.includes("\\sqrt{x}")), "demo steps include radical");
  assert(!blob.includes(FORBIDDEN_NAME_AR) && !blob.includes(FORBIDDEN_NAME_EN), "never الطارة / Al-Tarah");
  assert(INSTRUCTOR_EN.includes("Haddara") && INSTRUCTOR_AR.includes("حداره"), "Munzer Haddara branding");

  console.log("lebanese-equation-format ok ·", dictation);
}

main();
