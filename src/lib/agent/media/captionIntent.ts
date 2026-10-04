/**
 * Decide what محمد should do with an inbound image / document from its caption.
 * Dependency-free (unit-tested).
 */

export type MediaAction = "solve" | "summarize" | "verify_exam" | "store";

const VERIFY_RE =
  /صحّح|صحح|تصحيح|دقّق|دقق|تدقيق|تحقّق|تحقق|راجع|مراجعة|verify|check|review|correct|barème|bareme|grade/i;
const SUMMARIZE_RE = /لخّص|لخص|ملخّص|ملخص|تلخيص|summar|résum|resum|extract|استخرج|اقرأ|اقرا/i;
const STORE_RE = /احفظ|إحفظ|خزّن|خزن|أرشف|ارشف|\bsave\b|\bstore\b|archive|للأرشيف|للارشيف/i;
const SOLVE_RE = /حلّ|حل|حلها|حلا|solve|résou|resou|answer|جاوب|أجب|اجب/i;
/**
 * "PDF" as typed or as speech-to-text writes it: pdf / PDF, «بي دي إف / أف / اف», «بدف», «ملف», file,
 * document, fichier. (The old pattern missed «بي دي إف» — the usual Arabic spelling and what
 * Whisper / Gemini transcripts produce — so voice requests never got their PDF.)
 */
const PDF_RE =
  /pdf|بي\s*دي\s*[اإأآ]ف|ب\s*د\s*ف|بدف|پي\s*دي\s*[اإأآ]ف|كملف|ك\s*ملف|(?:^|[\s،,.:;!؟?«(])(?:ب?ال)?ملف|\bfile\b|\bdocument\b|مستند|fichier/i;

/**
 * Caption wins when present. Defaults:
 * - image → solve (a photographed math problem)
 * - PDF / text → summarize
 * - other documents / video → store
 */
export function detectMediaAction(input: {
  caption?: string;
  category: "image" | "document" | "video" | "audio";
  readable: boolean;
}): MediaAction {
  const caption = (input.caption || "").trim();
  if (input.category === "video" || input.category === "audio") return "store";
  // Files محمد cannot read (e.g. .docx) are stored; the handler explains how to resend.
  if (!input.readable) return "store";
  if (caption) {
    if (STORE_RE.test(caption) && !SOLVE_RE.test(caption.replace(STORE_RE, ""))) return "store";
    if (VERIFY_RE.test(caption)) return "verify_exam";
    if (SUMMARIZE_RE.test(caption)) return "summarize";
    if (SOLVE_RE.test(caption)) return "solve";
  }
  if (input.category === "image") return "solve";
  return caption ? "solve" : "summarize";
}

/** Caption asks for the answer as a PDF document. */
export function wantsPdfReply(caption: string | undefined): boolean {
  return PDF_RE.test(caption || "");
}

/**
 * When محمد attaches the branded PDF to a maths answer on WhatsApp:
 * - "always" (default): every solved problem (typed, voice note or photo) also gets the PDF;
 * - "on_request": only when the message asks for it (pdf / بي دي إف / ملف …).
 * Set with WHATSAPP_PDF_REPLY=always|on_request.
 */
export type PdfReplyMode = "always" | "on_request";

export function pdfReplyMode(env: Record<string, string | undefined> = process.env): PdfReplyMode {
  const raw = (env.WHATSAPP_PDF_REPLY || "").trim().toLowerCase();
  return raw === "on_request" || raw === "on-request" || raw === "request" ? "on_request" : "always";
}

/** Attach the solution PDF to this maths answer? */
export function shouldSendPdf(text: string | undefined, mode: PdfReplyMode = pdfReplyMode()): boolean {
  return mode === "always" || wantsPdfReply(text);
}

/** Text command asking محمد for a mock exam PDF. */
export function parseMockExamRequest(text: string | undefined): { matched: boolean; track?: string } {
  const t = (text || "").trim();
  if (!t) return { matched: false };
  const matched =
    /(امتحان|مسابقة|اختبار|فحص)\s*(تجريبي|تجريبية|تدريبي)|mock\s*exam|practice\s*exam|examen\s*blanc/i.test(t);
  if (!matched) return { matched: false };
  let track: string | undefined;
  if (/brevet|بريفيه|بروفيه|متوسط|تاسع/i.test(t)) track = "brevet";
  else if (/\bsat\b|سات/i.test(t)) track = "sat";
  else if (/\bgs\b|علوم\s*عامة|عامّة/i.test(t)) track = "terminale-gs";
  else if (/\bse\b|اقتصاد|اجتماع/i.test(t)) track = "terminale-se";
  else if (/\bls\b|علوم\s*الحياة|حياة/i.test(t)) track = "terminale-ls";
  return { matched: true, track };
}
