/**
 * Render a solver MathSolution for WhatsApp (Arabic text, readable math) and as a branded PDF
 * (embedded Arabic + Latin fonts; header/footer «منذر حداره · MathMentor»).
 * Math uses the Lebanese Word-Equation LaTeX (formatLebaneseEquation) converted for each channel.
 */
import { buildSimplePdf } from "@/lib/exams/pdf";
import { brandedPdfFilename, buildBrandedPdf, MATHMENTOR_BRAND, type PdfBlock } from "@/lib/pdf/brandedPdf";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import { asciiForPdf, latexToReadable } from "@/lib/math/latexToReadable";
import type { SolutionVerdict } from "@/lib/solver/verify";
import type { MathSolution } from "@/lib/solver/types";
import { MEDIA_SIGNATURE_AR } from "@/lib/whatsapp/media/errorsAr";
import { whatsappPersonaText } from "@/lib/whatsapp/agentCore";

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
  options?: { verdict?: SolutionVerdict; headerAr?: string },
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
    const title = whatsappPersonaText(step.titleAr || step.title);
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
  if (solution.warning && (solution.source === "demo" || solution.needsReview)) {
    lines.push(`⚠️ ${whatsappPersonaText(solution.warning).slice(0, 200)}`);
  }
  lines.push(MEDIA_SIGNATURE_AR);
  return clampWhatsAppText(whatsappPersonaText(lines.join("\n")));
}

function verdictLineEn(verdict: SolutionVerdict | undefined): string {
  if (!verdict) return "Verification: not run";
  if (verdict.status === "verified") return "Verification (Mohamed): verified";
  if (verdict.status === "needs_fix") {
    return `Verification (Mohamed): NEEDS REVIEW${verdict.correctedFinalAnswer ? ` - suggested fix: ${verdict.correctedFinalAnswer}` : ""}`;
  }
  return "Verification (Mohamed): uncertain - needs teacher review";
}

/** WhatsApp file name of every solution PDF (platform brand, never a generic name). */
export const SOLUTION_PDF_FILENAME = brandedPdfFilename("solution");
/** Caption on the WhatsApp document message. */
export const SOLUTION_PDF_CAPTION_AR = `📄 الحل الكامل — ${MATHMENTOR_BRAND.headerAr}`;

export type SolutionPdfOptions = { verdict?: SolutionVerdict; question?: string; createdAt?: Date };
export type SolutionPdfResult = { bytes: Buffer; renderer: "unicode" | "latin_fallback"; error?: string };

/** Readable (Unicode) maths for the PDF: x², √, ≤, ∞ … (the embedded fonts cover them). */
function pdfMathUnicode(tex: string | undefined): string {
  if (!tex?.trim()) return "";
  return latexToReadable(formatLebaneseEquation(tex));
}

function verdictLineArPdf(verdict: SolutionVerdict | undefined): string {
  if (!verdict) return "التحقّق: لم يُشغَّل.";
  return verdict.noteAr || verdictLineEn(verdict);
}

/** YYYY-MM-DD in the platform's time zone (Asia/Beirut). */
function beirutDate(date: Date): string {
  try {
    return date.toLocaleDateString("en-CA", { timeZone: "Asia/Beirut" });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Branded Unicode PDF blocks (Arabic + Latin + maths) for a solver MathSolution. */
export function solutionPdfBlocks(solution: MathSolution, options?: SolutionPdfOptions): PdfBlock[] {
  const created = options?.createdAt ?? new Date();
  const blocks: PdfBlock[] = [
    {
      kind: "subtitle",
      text: `${solution.track} · ${whatsappPersonaText(solution.topic, { latin: true })} · ${beirutDate(created)}`,
    },
  ];
  const question = (options?.question || "").trim();
  if (question) {
    blocks.push({ kind: "heading", text: "السؤال" });
    blocks.push({ kind: "paragraph", text: waProse(question) });
  }
  const given = pdfMathUnicode(solution.given?.latex);
  const aim = solution.given?.aimAr || solution.given?.aimEn;
  if (given || aim) {
    blocks.push({ kind: "heading", text: "المعطيات والمطلوب" });
    if (given) blocks.push({ kind: "math", text: given });
    if (aim) blocks.push({ kind: "paragraph", text: `المطلوب: ${waProse(aim)}` });
  }
  if (solution.steps.length) blocks.push({ kind: "heading", text: "خطوات الحل" });
  solution.steps.forEach((step, index) => {
    const title = waProse(whatsappPersonaText(step.titleAr || step.title));
    blocks.push({ kind: "paragraph", text: `${index + 1}) ${title}`, bold: true });
    const math = pdfMathUnicode(step.latex);
    if (math) blocks.push({ kind: "math", text: math });
    const why = step.explanationAr || step.explanationEn;
    if (why) blocks.push({ kind: "paragraph", text: waProse(whatsappPersonaText(why)), indent: 12 });
    const theorem = step.theoremAr || step.theoremEn;
    if (theorem) blocks.push({ kind: "paragraph", text: `القاعدة: ${waProse(theorem)}`, indent: 12, muted: true });
  });
  const final = pdfMathUnicode(solution.finalAnswerLatex) || solution.finalAnswer;
  if (final) blocks.push({ kind: "highlight", text: `الجواب النهائي: ${final}` });
  if (solution.finalAnswerLatex) {
    blocks.push({ kind: "paragraph", text: `LaTeX (Word Equation): ${formatLebaneseEquation(solution.finalAnswerLatex)}`, muted: true });
  }
  const tip = solution.examTip?.ar || solution.examTip?.en;
  if (tip) {
    blocks.push({ kind: "heading", text: "نصيحة للامتحان" });
    blocks.push({ kind: "paragraph", text: waProse(tip) });
  }
  blocks.push({ kind: "rule" });
  blocks.push({ kind: "paragraph", text: verdictLineArPdf(options?.verdict), muted: true });
  if (solution.warning && (solution.source === "demo" || solution.needsReview)) {
    blocks.push({ kind: "paragraph", text: `⚠ ${whatsappPersonaText(solution.warning)}`, muted: true });
  }
  blocks.push({ kind: "paragraph", text: MEDIA_SIGNATURE_AR, muted: true });
  return blocks;
}

/** Latin-only fallback (Helvetica) used when the embedded fonts cannot be loaded. */
export function solutionPdfLatin(solution: MathSolution, options?: SolutionPdfOptions): Buffer {
  const lines: string[] = [
    `${MATHMENTOR_BRAND.headerLatin} - solution by Mohamed (AI assistant)`,
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
    lines.push(`Step ${index + 1}. ${pdfProse(whatsappPersonaText(step.title, { latin: true }))}`);
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
  lines.push("", verdictLineEn(options?.verdict), "", `${MATHMENTOR_BRAND.headerLatin} - mathmentor`);
  return buildSimplePdf(`${MATHMENTOR_BRAND.headerLatin} - Worked solution`, lines);
}

/**
 * Branded solution PDF: Unicode (Arabic-capable) renderer first, Latin-only builder as a fallback.
 * Throws only if both fail (callers catch, log and tell the student).
 */
export function renderSolutionPdf(solution: MathSolution, options?: SolutionPdfOptions): SolutionPdfResult {
  try {
    const bytes = buildBrandedPdf({ title: "حل المسألة — Worked solution", blocks: solutionPdfBlocks(solution, options), createdAt: options?.createdAt });
    return { bytes, renderer: "unicode" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unicode pdf failed";
    console.error(`[whatsapp-agent] branded PDF renderer failed, using the Latin fallback: ${message.slice(0, 200)}`);
    return { bytes: solutionPdfLatin(solution, options), renderer: "latin_fallback", error: message };
  }
}

/** Back-compat: the solution PDF bytes. */
export function solutionPdf(solution: MathSolution, options?: SolutionPdfOptions): Buffer {
  return renderSolutionPdf(solution, options).bytes;
}
