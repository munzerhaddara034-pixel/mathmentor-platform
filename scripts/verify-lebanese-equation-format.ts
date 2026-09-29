/**
 * Lebanese / Word Insert Equation formatting layer.
 * Run: npx tsx scripts/verify-lebanese-equation-format.ts
 */
import {
  formatLebaneseEquation,
  formatLatexFields,
  formatMathIslands,
  hasForbiddenEquationForm,
  spokenMathToLebaneseLatex,
} from "../src/lib/math/lebaneseEquationFormat";
import { FORMULA_SHEETS } from "../src/lib/exams/formulas";
import { OFFICIAL_PAPERS } from "../src/lib/exams/papers";
import { questionsForLesson } from "../src/lib/quizBank";
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

  const island = formatMathIslands("Factor: $x^2-4=(x-2)(x+2)$. Then $1/x$.");
  assert(island.includes("x^{2}"), "quiz-bank $x^2$ island is braced");
  assert(island.includes("\\frac{1}{x}"), "quiz-bank $1/x$ island is stacked");
  assert(!island.includes("$x^2"), "quiz-bank island does not keep a raw caret");
  assert(
    formatMathIslands("Show that / Montrer que") === "Show that / Montrer que",
    "bilingual Show that / Montrer que is not a fraction",
  );

  const quizLatex = questionsForLesson("grade-12-ch1")
    .map((item) => item.latex)
    .filter((item): item is string => Boolean(item));
  assert(quizLatex.length > 0, "grade-12-ch1 question bank has latex");
  for (const tex of quizLatex) {
    assert(!hasForbiddenEquationForm(tex), `quiz latex is booklet-clean: ${tex}`);
    assert(!tex.includes("sqrt(") && !/(?<![\\A-Za-z])sqrt\b/i.test(tex), `quiz latex has no sqrt word: ${tex}`);
  }
  const limitQ = quizLatex.find((tex) => tex.includes("\\lim"));
  assert(limitQ && limitQ.includes("\\lim\\limits_"), "quiz limit uses \\lim\\limits");
  const fracQ = quizLatex.find((tex) => tex.includes("x^{2}-4") || tex.includes("x^2-4"));
  assert(fracQ && fracQ.includes("x^{2}"), "quiz (x^2-4)/(x-2) braces the power");
  assert(fracQ && fracQ.includes("\\frac"), "quiz difference quotient is a stacked fraction");

  for (const sheet of FORMULA_SHEETS) {
    for (const item of sheet.items) {
      const cleaned = formatLebaneseEquation(item.latex);
      assert(!hasForbiddenEquationForm(cleaned), `formula ${sheet.id} ${item.name}: ${cleaned}`);
    }
  }
  const powerLog = formatLebaneseEquation("\\log_a(x^k)=k\\log_a x");
  assert(powerLog.includes("x^{k}"), "formula-sheet x^k is a true superscript");
  const integralPower = formatLebaneseEquation("\\int x^n\\,dx");
  assert(integralPower.includes("x^{n}"), "formula-sheet integral power is braced");
  assert(formatLebaneseEquation("\\int_0^1 x^n\\,dx").includes("\\int\\limits_{0}^{1}"), "formula integral bounds");

  const examLatex = OFFICIAL_PAPERS.flatMap((paper) =>
    paper.parts.flatMap((part) => part.questions.flatMap((question) => question.subs.map((sub) => sub.latex).filter(Boolean))),
  ) as string[];
  for (const tex of examLatex) {
    const cleaned = formatLebaneseEquation(tex);
    assert(!hasForbiddenEquationForm(cleaned), `exam latex is booklet-clean: ${cleaned}`);
  }
  assert(formatLebaneseEquation("x^2-5x+6") === "x^{2}-5x+6", "brevet trinomial braces x^2");
  assert(formatLebaneseEquation("f(x)=(x-1)e^x").includes("e^{x}"), "terminale e^x is a superscript");
  assert(formatLebaneseEquation("P(X=2)=\\binom{4}{2}(1/2)^4").includes("\\frac{1}{2}"), "binomial 1/2 is stacked");

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
