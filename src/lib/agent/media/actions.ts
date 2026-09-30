/**
 * What محمد does with a received file: solve (+ verify), summarize, verify an exam.
 * Every external call is wrapped; each action returns a ready Arabic reply.
 */
import { AGENT_PERSONA_AR, SOLUTION_VERIFIER_RULES_AR } from "@/lib/agent/persona";
import { runMathSolver } from "@/lib/solver/engine";
import { hasGeminiKey } from "@/lib/solver/llm";
import { patchMathQuery, saveMathQuery } from "@/lib/solver/store";
import { verifySolution, type SolutionVerdict } from "@/lib/solver/verify";
import type { MathQueryRecord, MathSolution } from "@/lib/solver/types";
import { mediaErrorReplyAr, MEDIA_SIGNATURE_AR } from "@/lib/whatsapp/media/errorsAr";
import { isPdfMime } from "@/lib/whatsapp/media/policy";
import { geminiReadFile } from "./geminiFile";
import { extractPdfText } from "./pdfText";
import { clampWhatsAppText, solutionPdf, solutionWhatsAppTextAr } from "./solutionFormat";

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

/** Image / PDF of a math problem → Gemini vision solver → محمد verifier → reply (+ optional PDF). */
export async function solveFileAction(file: FileForAction, from: string, wantPdf: boolean): Promise<ActionOutcome> {
  if (!hasGeminiKey()) return { ok: false, replyAr: `${GEMINI_MISSING_AR}\n${MEDIA_SIGNATURE_AR}`, relatedIds: [], note: "gemini_missing" };

  let solution: MathSolution;
  try {
    solution = await runMathSolver({
      question: file.caption || "",
      language: "ar",
      imageName: file.filename,
      imageBase64: file.bytes.toString("base64"),
      mimeType: file.mimeType,
    });
  } catch (error) {
    return { ok: false, replyAr: "", relatedIds: [], note: error instanceof Error ? error.message : "solver failed" };
  }

  // runMathSolver maps a Gemini *failure* on a photo to a demo "retake" — don't blame the photo.
  if (solution.needsRetake && solution.source === "demo") {
    return {
      ok: false,
      replyAr: mediaErrorReplyAr("ai_busy", { kindAr: isPdfMime(file.mimeType) ? "الملف" : "الصورة" }),
      relatedIds: [],
      note: "gemini_unavailable",
    };
  }

  const relatedIds: string[] = [];
  let verdict: SolutionVerdict | undefined;
  let record: MathQueryRecord | undefined;
  try {
    record = await saveMathQuery(toRecord(solution, file, from));
    relatedIds.push(record.id);
  } catch {
    record = undefined;
  }
  if (!solution.needsRetake && solution.source !== "demo") {
    try {
      const probe: MathQueryRecord = record ?? {
        ...toRecord(solution, file, from),
        id: "unsaved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      verdict = await verifySolution(probe);
      if (record) {
        await patchMathQuery(record.id, {
          auditStatus: verdict.status === "unverified" ? "pending" : verdict.status,
          auditNote: verdict.noteAr,
        });
      }
    } catch {
      verdict = undefined;
    }
  }

  let pdf: ActionOutcome["pdf"];
  if (wantPdf && !solution.needsRetake) {
    try {
      pdf = {
        bytes: solutionPdf(solution, { verdict, question: file.caption }),
        filename: `MathMentor-solution-${new Date().toISOString().slice(0, 10)}.pdf`,
        caption: "📄 الحل الكامل — محمد · الأستاذ منذر حداره",
      };
    } catch {
      pdf = undefined;
    }
  }
  return {
    ok: !solution.needsRetake,
    replyAr: solutionWhatsAppTextAr(solution, { verdict, pdfAttached: Boolean(pdf) }),
    relatedIds,
    pdf,
    note: verdict ? `verify:${verdict.status}` : undefined,
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
  if (!result.ok) return { ok: false, replyAr: "", relatedIds: [], note: result.error };
  return {
    ok: true,
    replyAr: clampWhatsAppText(`🔎 تدقيق محمد لـ ${file.filename}:\n\n${result.text}\n\n${MEDIA_SIGNATURE_AR}`),
    relatedIds: [],
  };
}
