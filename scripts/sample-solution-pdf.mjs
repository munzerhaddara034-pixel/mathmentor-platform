// Local preview of the branded WhatsApp solution PDF (no network, no sends).
// Usage: node --import ./tests/support/register.mjs scripts/sample-solution-pdf.mjs [out.pdf]
import { writeFileSync } from "node:fs";
import { renderSolutionPdf, SOLUTION_PDF_FILENAME, SOLUTION_PDF_CAPTION_AR } from "../src/lib/agent/media/solutionFormat.ts";

const solution = {
  summary: "Quadratic equation",
  finalAnswer: "S = {2 ; 3}",
  finalAnswerLatex: "S=\\{2\\,;\\,3\\}",
  examTip: { en: "Always compute the discriminant first.", fr: "", ar: "احسب المميّز Δ أولاً وتأكّد من إشارته قبل ما تكتب الحلول، وتحقّق بالتعويض." },
  studyKind: "algebra",
  given: { latex: "x^{2}-5x+6=0", aimEn: "Solve in R", aimAr: "حلّ المعادلة في ℝ." },
  steps: [
    {
      title: "Identify the coefficients",
      titleAr: "تحديد المعاملات",
      latex: "a=1,\\ b=-5,\\ c=6",
      explanationEn: "Compare with ax^2 + bx + c = 0.",
      explanationFr: "",
      explanationAr: "نقارن المعادلة مع الشكل العام ax² + bx + c = 0.",
    },
    {
      title: "Discriminant",
      titleAr: "حساب المميّز",
      latex: "\\Delta=b^{2}-4ac=(-5)^{2}-4(1)(6)=25-24=1",
      explanationEn: "Delta > 0 so there are two distinct real roots.",
      explanationFr: "",
      explanationAr: "بما أنّ Δ = 1 > 0، للمعادلة حلّان حقيقيان مختلفان.",
      theoremAr: "إذا كان Δ > 0 فللمعادلة جذران حقيقيان مختلفان.",
    },
    {
      title: "Roots",
      titleAr: "إيجاد الحلول",
      latex: "x_{1}=\\frac{5-\\sqrt{1}}{2}=2 \\quad x_{2}=\\frac{5+\\sqrt{1}}{2}=3",
      explanationEn: "Quadratic formula.",
      explanationFr: "",
      explanationAr: "نطبّق القانون العام: x = (−b ± √Δ) / (2a).",
    },
    {
      title: "Check",
      titleAr: "التحقّق",
      latex: "2^{2}-5(2)+6=0 \\quad 3^{2}-5(3)+6=0",
      explanationEn: "Both values satisfy the equation.",
      explanationFr: "",
      explanationAr: "نعوّض القيمتين في المعادلة: كلّ منهما يحقّقها.",
    },
  ],
  avatarScript: {},
  canvasTimeline: {},
  timeline: {},
  topic: "Quadratic equations",
  topicTag: "algebra",
  track: "terminale-ls",
  language: "ar",
  source: "gemini",
  needsRetake: false,
};

const out = process.argv[2] || "pdf-fix-sample.pdf";
const rendered = renderSolutionPdf(solution, {
  question: "حلّ المعادلة x² − 5x + 6 = 0 وابعتلي الحل بي دي إف",
  verdict: { status: "verified", noteAr: "✅ تحقّق محمد: الحل صحيح (تعويض الجذرين في المعادلة).", issues: [], calls: [] },
});
writeFileSync(out, rendered.bytes);
console.log(JSON.stringify({ out, renderer: rendered.renderer, bytes: rendered.bytes.length, whatsappFilename: SOLUTION_PDF_FILENAME, caption: SOLUTION_PDF_CAPTION_AR }));
