/**
 * What محمد does with a received file: solve (+ verify), summarize, verify an exam.
 * Every external call is wrapped; each action returns a ready Arabic reply.
 */
import { AGENT_PERSONA_AR, SOLUTION_VERIFIER_RULES_AR } from "@/lib/agent/persona";
import { solveAndVerify } from "@/lib/solver/pipeline";
import { hasGeminiKey } from "@/lib/solver/llm";
import { patchMathQuery, saveMathQuery } from "@/lib/solver/store";
import { verifySolution, type SolutionVerdict } from "@/lib/solver/verify";
import type { MathQueryRecord, MathSolution } from "@/lib/solver/types";
import { mediaErrorReplyAr, MEDIA_SIGNATURE_AR } from "@/lib/whatsapp/media/errorsAr";
import { isPdfMime } from "@/lib/whatsapp/media/policy";
import { geminiReadFile } from "./geminiFile";
import { extractPdfText } from "./pdfText";
import {
  clampWhatsAppText,
  renderSolutionPdf,
  SOLUTION_PDF_CAPTION_AR,
  SOLUTION_PDF_FILENAME,
  solutionWhatsAppTextAr,
} from "./solutionFormat";
import {
  isGeminiQuotaError,
  QUOTA_APOLOGY_AR,
  type MathSolveOutcome,
  type MathSolveRequest,
  type ReplyAttachment,
} from "@/lib/whatsapp/agentCore";

export type FileForAction = {
  bytes: Buffer;
  mimeType: string;
  filename: string;
  caption?: string;
  recordId: string;
  fileUrl: string;
};

export type ActionOutcome = {
  ok: boolean;
  replyAr: string;
  relatedIds: string[];
  pdf?: { bytes: Buffer; filename: string; caption: string };
  /** A PDF was due but could not be generated. */
  pdfError?: string;
  note?: string;
};

export const GEMINI_MISSING_AR =
  "استلمت الملف وحفظتو ✅ بس خدمة القراءة الذكية (Gemini) مش مفعّلة على الخادم حالياً، فما قدرت إقراه.\n" +
  "بس تتفعّل GEMINI_API_KEY بقدر حلّ وتلخّص الملفات مباشرة.";

const READABLE_MATH_RULE =
  "اكتب الرياضيات بشكل مقروء على واتساب بدون LaTeX: x² ، √(x) ، (a)/(b) ، ∞ ، → ، ℝ. " +
  "استخدم عربية واضحة (لهجة لبنانية مهذّبة مقبولة) ونقاطاً قصيرة. لا تتجاوز 3000 حرف.";

function toRecord(solution: MathSolution, file: FileForAction, from: string): Omit<MathQueryRecord, "id" | "createdAt" | "updatedAt"> {
  return {
    userId: `whatsapp-${from}`,
    userName: "WhatsApp (instructor)",
    userEmail: "",
    question: file.caption || `(WhatsApp ${isPdfMime(file.mimeType) ? "PDF" : "image"}) ${file.filename}`,
    imageUrl: file.fileUrl,
    imageName: file.filename,
    language: solution.language,
    track: solution.track,
    topic: solution.topic,
    topicTag: solution.topicTag,
    summary: solution.summary,
    given: solution.given,
    examTip: solution.examTip,
    studyKind: solution.studyKind,
    asymptotes: solution.asymptotes,
    finalAnswer: solution.finalAnswer,
    finalAnswerLatex: solution.finalAnswerLatex,
    steps: solution.steps,
    avatarScript: solution.avatarScript,
    canvasTimeline: solution.canvasTimeline,
    timeline: solution.timeline,
    source: solution.source,
    warning: solution.warning,
    needsRetake: solution.needsRetake,
    retakeMessageEn: solution.retakeMessageEn,
    retakeMessageAr: solution.retakeMessageAr,
    auditStatus: "pending",
    videoStatus: "none",
  };
}

function toVerdict(solution: MathSolution): SolutionVerdict | undefined {
  const v = solution.solverMeta?.verification;
  if (!v) return undefined;
  return { status: v.status, noteAr: v.noteAr, issues: [], calls: [] };
}

/**
 * The WhatsApp maths answer for محمد: the upgraded solver (solveAndVerify — fast/strong tiers, CAS
 * check, repair pass, sync verification for Bac / university) on a typed question, a transcribed
 * voice note or a photo. 429 → { reason: "quota" } so the caller sends a short apology.
 */
export async function solveForWhatsApp(request: MathSolveRequest): Promise<MathSolveOutcome> {
  if (!hasGeminiKey()) {
    const textAr = request.imageBase64
      ? `${GEMINI_MISSING_AR}\n${MEDIA_SIGNATURE_AR}`
      : `وصلني سؤالك ✅ بس خدمة الحلّ الذكي (Gemini) مش مفعّلة على الخادم حالياً، فما قدرت حلّه.\n${MEDIA_SIGNATURE_AR}`;
    return { ok: false, reason: "unavailable", textAr, error: "gemini_missing" };
  }
  const file: FileForAction = {
    bytes: request.imageBase64 ? Buffer.from(request.imageBase64, "base64") : Buffer.alloc(0),
    mimeType: request.mimeType || (request.imageBase64 ? "image/jpeg" : "text/plain"),
    filename: request.imageName || (request.imageBase64 ? "whatsapp-photo" : "whatsapp-text"),
    caption: request.question,
    recordId: request.imageName || "",
    fileUrl: "",
  };

  let solution: MathSolution;
  try {
    solution = await solveAndVerify({
      question: request.question || "",
      language: "ar",
      imageBase64: request.imageBase64,
      mimeType: request.imageBase64 ? request.mimeType : undefined,
      imageName: request.imageBase64 ? file.filename : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "solver failed";
    return { ok: false, reason: isGeminiQuotaError(error) ? "quota" : "failed", error: message };
  }
  if (solution.needsRetake) {
    return {
      ok: false,
      reason: "failed",
      // A demo "retake" means Gemini itself failed — don't blame the photo.
      textAr:
        solution.source === "demo"
          ? mediaErrorReplyAr("ai_busy", { kindAr: isPdfMime(request.mimeType) ? "الملف" : request.imageBase64 ? "الصورة" : "السؤال" })
          : solutionWhatsAppTextAr(solution, {}),
      error: "needs_retake",
    };
  }

  const relatedIds: string[] = [];
  let record: MathQueryRecord | undefined;
  try {
    record = await saveMathQuery(toRecord(solution, file, request.from));
    relatedIds.push(record.id);
  } catch {
    record = undefined;
  }

  let verdict = toVerdict(solution);
  if (!verdict && solution.source !== "demo") {
    try {
      const probe: MathQueryRecord = record ?? {
        ...toRecord(solution, file, request.from),
        id: "unsaved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      verdict = await verifySolution(probe);
    } catch (error) {
      if (isGeminiQuotaError(error)) console.error("[whatsapp-agent] Gemini quota exhausted (429) during verification");
      verdict = undefined;
    }
  }
  if (record && verdict) {
    try {
      await patchMathQuery(record.id, {
        auditStatus: verdict.status === "unverified" ? "pending" : verdict.status,
        auditNote: verdict.noteAr,
      });
    } catch {
      /* audit status is best effort */
    }
  }

  let pdf: ReplyAttachment | undefined;
  let pdfError: string | undefined;
  if (request.wantPdf) {
    try {
      const rendered = renderSolutionPdf(solution, { verdict, question: request.question });
      if (!rendered.bytes.length) throw new Error("empty PDF");
      pdf = {
        bytes: rendered.bytes,
        filename: SOLUTION_PDF_FILENAME,
        caption: SOLUTION_PDF_CAPTION_AR,
        mimeType: "application/pdf",
      };
      console.info(
        `[whatsapp-agent] solution PDF built (${rendered.renderer}, ${rendered.bytes.length} bytes) for …${request.from.slice(-4)}`,
      );
    } catch (error) {
      pdfError = error instanceof Error ? error.message : "pdf build failed";
      console.error(`[whatsapp-agent] solution PDF build failed: ${pdfError.slice(0, 200)}`);
      pdf = undefined;
    }
  }
  return {
    ok: true,
    textAr: solutionWhatsAppTextAr(solution, { verdict }),
    pdf,
    pdfError,
    relatedIds,
  };
}

/** Image / PDF of a math problem → upgraded solver (+ verification) → reply (+ optional PDF). */
export async function solveFileAction(file: FileForAction, from: string, wantPdf: boolean): Promise<ActionOutcome> {
  const outcome = await solveForWhatsApp({
    question: file.caption || "",
    imageBase64: file.bytes.toString("base64"),
    mimeType: file.mimeType,
    imageName: file.filename,
    wantPdf,
    from,
  });
  if (outcome.ok) {
    return {
      ok: true,
      replyAr: outcome.textAr,
      relatedIds: outcome.relatedIds ?? [],
      pdf: outcome.pdf ? { bytes: outcome.pdf.bytes, filename: outcome.pdf.filename, caption: outcome.pdf.caption } : undefined,
      pdfError: wantPdf && !outcome.pdf ? outcome.pdfError ?? "pdf_missing" : undefined,
    };
  }
  if (outcome.reason === "quota") {
    console.error("[whatsapp-agent] Gemini quota exhausted (429) while solving a file");
    return { ok: false, replyAr: QUOTA_APOLOGY_AR, relatedIds: [], note: "gemini_quota" };
  }
  if (outcome.reason === "unavailable") {
    return { ok: false, replyAr: outcome.textAr || "", relatedIds: [], note: "gemini_missing" };
  }
  return {
    ok: false,
    replyAr: outcome.textAr || mediaErrorReplyAr("ai_busy", { kindAr: isPdfMime(file.mimeType) ? "الملف" : "الصورة" }),
    relatedIds: [],
    note: outcome.error || "solver failed",
  };
}

async function fallbackPdfText(file: FileForAction): Promise<string> {
  if (!isPdfMime(file.mimeType)) return "";
  return extractPdfText(file.bytes);
}

/** Summarize / extract a PDF, text file or image. */
export async function summarizeFileAction(file: FileForAction): Promise<ActionOutcome> {
  const prompt = [
    AGENT_PERSONA_AR,
    "المرفق ملف أرسله الأستاذ منذر على واتساب.",
    file.caption ? `تعليمات الأستاذ: ${file.caption}` : "لخّص المحتوى: الموضوع، أهم النقاط، وإن وُجدت أسئلة رياضية فاذكرها باختصار مع مستوى الصعوبة.",
    READABLE_MATH_RULE,
  ].join("\n");
  const result = hasGeminiKey()
    ? await geminiReadFile({ prompt, bytes: file.bytes, mimeType: file.mimeType })
    : { ok: false as const, error: "GEMINI_API_KEY is not set" };
  if (result.ok) {
    return {
      ok: true,
      replyAr: clampWhatsAppText(`📑 ملخّص ${file.filename}:\n\n${result.text}\n\n${MEDIA_SIGNATURE_AR}`),
      relatedIds: [],
    };
  }
  const text = await fallbackPdfText(file);
  if (text) {
    return {
      ok: true,
      replyAr: clampWhatsAppText(
        `📑 استخرجت النص من ${file.filename} (بدون ذكاء اصطناعي — Gemini مش متاح):\n\n${text.slice(0, 2500)}\n\n${MEDIA_SIGNATURE_AR}`,
      ),
      relatedIds: [],
      note: `gemini_failed:${result.error.slice(0, 120)}`,
    };
  }
  if (!hasGeminiKey()) return { ok: false, replyAr: `${GEMINI_MISSING_AR}\n${MEDIA_SIGNATURE_AR}`, relatedIds: [], note: "gemini_missing" };
  if (isGeminiQuotaError(result.error)) {
    console.error("[whatsapp-agent] Gemini quota exhausted (429) while summarizing a file");
    return { ok: false, replyAr: QUOTA_APOLOGY_AR, relatedIds: [], note: "gemini_quota" };
  }
  return { ok: false, replyAr: "", relatedIds: [], note: result.error };
}

/** Verify an exam / worked solution as محمد (مدقّق الحلول) with the Lebanese barème rules. */
export async function verifyExamFileAction(file: FileForAction): Promise<ActionOutcome> {
  if (!hasGeminiKey()) return { ok: false, replyAr: `${GEMINI_MISSING_AR}\n${MEDIA_SIGNATURE_AR}`, relatedIds: [], note: "gemini_missing" };
  const prompt = [
    AGENT_PERSONA_AR,
    ...SOLUTION_VERIFIER_RULES_AR,
    "المرفق امتحان أو حل (أسئلة و/أو أجوبة). المطلوب تدقيقه سؤالاً سؤالاً:",
    "• لكل سؤال: ✅ صحيح / ❌ خطأ / ⚠️ غير متأكد، مع التصحيح المختصر إن وُجد خطأ.",
    "• أخطاء الصياغة أو المعطيات الناقصة أو الأسئلة المستحيلة.",
    "• ملاحظات على توزيع العلامات (Barème) إن وُجد.",
    "• في الختام: حكم عام بسطر واحد.",
    file.caption ? `تعليمات الأستاذ: ${file.caption}` : "",
    READABLE_MATH_RULE,
  ]
    .filter(Boolean)
    .join("\n");
  const result = await geminiReadFile({ prompt, bytes: file.bytes, mimeType: file.mimeType, temperature: 0 });
  if (!result.ok && isGeminiQuotaError(result.error)) {
    console.error("[whatsapp-agent] Gemini quota exhausted (429) while verifying an exam file");
    return { ok: false, replyAr: QUOTA_APOLOGY_AR, relatedIds: [], note: "gemini_quota" };
  }
  if (!result.ok) return { ok: false, replyAr: "", relatedIds: [], note: result.error };
  return {
    ok: true,
    replyAr: clampWhatsAppText(`🔎 تدقيق محمد لـ ${file.filename}:\n\n${result.text}\n\n${MEDIA_SIGNATURE_AR}`),
    relatedIds: [],
  };
}
