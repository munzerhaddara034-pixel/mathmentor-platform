/**
 * Render a solver MathSolution for WhatsApp (Arabic text, readable math) and as a simple PDF.
 * Math uses the Lebanese Word-Equation LaTeX (formatLebaneseEquation) converted for each channel.
 */
import { buildSimplePdf } from "@/lib/exams/pdf";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import { asciiForPdf, latexToReadable } from "@/lib/math/latexToReadable";
import type { SolutionVerdict } from "@/lib/solver/verify";
import type { MathSolution } from "@/lib/solver/types";
import { MEDIA_SIGNATURE_AR } from "@/lib/whatsapp/media/errorsAr";

/** WhatsApp text body limit is 4096; keep headroom. */
export const WHATSAPP_TEXT_MAX = 3800;

function waMath(tex: string | undefined): string {
  if (!tex?.trim()) return "";
  return latexToReadable(formatLebaneseEquation(tex));
}

function pdfMath(tex: string | undefined): string {
  if (!tex?.trim()) return "";
  return asciiForPdf(latexToReadable(formatLebaneseEquation(tex), { ascii: true }));
}

/** Prose that embeds inline LaTeX (\\Delta, ax^{2}, x_{1}) → readable text. */
function waProse(text: string | undefined): string {
  return text?.trim() ? latexToReadable(text) : "";
}

function pdfProse(text: string | undefined): string {
  return text?.trim() ? asciiForPdf(text) : "";
}

/** The simple PDF font is Latin-only: keep a line only when it is mostly ASCII. */
function latinOnly(text: string | undefined): string {
  const t = (text || "").trim();
  if (!t) return "";
  const nonAscii = [...t].filter((c) => c.charCodeAt(0) > 126).length;
  return nonAscii / t.length > 0.2 ? "" : t;
}

export function verdictLineAr(verdict: SolutionVerdict | undefined): string {
  if (!verdict) return "";
  return verdict.noteAr;
}

export function clampWhatsAppText(text: string, max = WHATSAPP_TEXT_MAX): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 60).trimEnd()}\n…\n(الحل الكامل بـ Agent Hub أو اطلبو PDF)`;
}

export function solutionWhatsAppTextAr(
  solution: MathSolution,
  options?: { verdict?: SolutionVerdict; headerAr?: string; pdfAttached?: boolean },
): string {
  if (solution.needsRetake) {
    return [
      "📸 الصورة مش واضحة كفاية لحلّ المسألة.",
      solution.retakeMessageAr || "صوّرها من فوق، بإضاءة منيحة، وخلّي كل المسألة بالصورة.",
      MEDIA_SIGNATURE_AR,
    ].join("\n");
  }
  const lines: string[] = [options?.headerAr || "🧮 محمد حلّ المسألة:"];
  const given = waMath(solution.given?.latex);
  if (given) lines.push(`المعطيات: ${given}`);
  if (solution.given?.aimAr) lines.push(`المطلوب: ${waProse(solution.given.aimAr)}`);
  lines.push("");
  solution.steps.slice(0, 12).forEach((step, index) => {
    const title = step.titleAr || step.title;
    lines.push(`${index + 1}) ${waProse(title)}`);
    const math = waMath(step.latex);
    if (math) lines.push(`   ${math}`);
    const why = step.explanationAr || step.explanationEn;
    if (why) lines.push(`   ${waProse(why).slice(0, 280)}`);
  });
  const final = waMath(solution.finalAnswerLatex) || solution.finalAnswer;
  if (final) {
    lines.push("");
    lines.push(`✅ الجواب النهائي: ${final}`);
  }
  if (solution.examTip?.ar) lines.push(`💡 ${waProse(solution.examTip.ar).slice(0, 240)}`);
  const verdict = verdictLineAr(options?.verdict);
  if (verdict) lines.push("", verdict);
  if (solution.warning && solution.source === "demo") lines.push(`⚠️ ${solution.warning.slice(0, 200)}`);
  if (options?.pdfAttached) lines.push("📄 بعتتلك الحل كمان كملف PDF.");
  lines.push(MEDIA_SIGNATURE_AR);
  return clampWhatsAppText(lines.join("\n"));
}

function verdictLineEn(verdict: SolutionVerdict | undefined): string {
  if (!verdict) return "Verification: not run";
  if (verdict.status === "verified") return "Verification (Mohamed): verified";
  if (verdict.status === "needs_fix") {
    return `Verification (Mohamed): NEEDS REVIEW${verdict.correctedFinalAnswer ? ` - suggested fix: ${verdict.correctedFinalAnswer}` : ""}`;
  }
  return "Verification (Mohamed): uncertain - needs teacher review";
}

/** Simple (Helvetica, Latin-only) PDF of the solution with readable math + Word-Equation LaTeX. */
export function solutionPdf(solution: MathSolution, options?: { verdict?: SolutionVerdict; question?: string }): Buffer {
  const lines: string[] = [
    "Prof. Munzer Haddara / MathMentor - solution by Mohamed (AI assistant)",
    `Track: ${solution.track}   Topic: ${asciiForPdf(solution.topic)}`,
    "",
  ];
  const question = latinOnly(options?.question);
  if (question) lines.push(`Question: ${pdfProse(question)}`);
  const given = pdfMath(solution.given?.latex);
  if (given) lines.push(`Given: ${given}`);
  if (solution.given?.aimEn) lines.push(`Aim: ${pdfProse(solution.given.aimEn)}`);
  lines.push("");
  solution.steps.forEach((step, index) => {
    lines.push(`Step ${index + 1}. ${pdfProse(step.title)}`);
    const math = pdfMath(step.latex);
    if (math) lines.push(`    ${math}`);
    if (step.explanationEn) lines.push(`    ${pdfProse(step.explanationEn)}`);
    if (step.theoremEn) lines.push(`    Theorem: ${pdfProse(step.theoremEn)}`);
    lines.push("");
  });
  const final = pdfMath(solution.finalAnswerLatex) || solution.finalAnswer;
  lines.push(`FINAL ANSWER: ${asciiForPdf(final)}`);
  if (solution.finalAnswerLatex) lines.push(`LaTeX (Word Equation): ${formatLebaneseEquation(solution.finalAnswerLatex)}`);
  if (solution.examTip?.en) lines.push("", `Exam tip: ${pdfProse(solution.examTip.en)}`);
  lines.push("", verdictLineEn(options?.verdict));
  return buildSimplePdf("MathMentor - Worked solution", lines);
}
