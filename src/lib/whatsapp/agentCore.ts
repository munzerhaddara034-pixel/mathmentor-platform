/**
 * Dependency-free core of the WhatsApp maths agent «محمد» (unit-tested with a mocked fetch):
 * - Meta Graph media: GET /{media-id} → GET url (Bearer) download, POST /{phone-id}/media upload,
 *   POST /{phone-id}/messages send (documents go by uploaded media id, never by public link).
 * - Gemini voice-note transcription (inline audio, ogg/opus → audio/ogg) over a model list.
 * - Gemini quota (429) detection, maths-request detection, and the per-message turn
 *   (text / voice note / photo → upgraded solver → signed reply, PDF attached on request).
 * Relative imports with .ts extensions only, so `node --test` loads it without the Next alias.
 */
import { parseMockExamRequest, shouldSendPdf, wantsPdfReply } from "../agent/media/captionIntent.ts";
import { MEDIA_SIGNATURE_AR } from "./media/errorsAr.ts";
import { baseMime, checkInboundMedia, INBOUND_MAX_BYTES, type MediaCategory } from "./media/policy.ts";
import { isMetaMediaHost } from "./mediaHosts.ts";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Graph access: bearer token, sender phone-number id and a URL builder (`v21.0/<path>`). */
export type GraphConfig = { token: string; phoneNumberId: string; graphUrl: (path: string) => string };

const NETWORK_TIMEOUT_MS = 45_000;

/* ------------------------------------------------------------------ Graph helpers */

/** Short, secret-free error detail from a Graph response. */
export async function graphErrorText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text) as { error?: { message?: string; code?: number } };
      if (json.error?.message) return `${response.status} (${json.error.code ?? "?"}): ${json.error.message.slice(0, 200)}`;
    } catch {
      /* not JSON */
    }
    return `${response.status}: ${text.slice(0, 200)}`;
  } catch {
    return String(response.status);
  }
}

export type CoreDownloadFailureReason = "too_big" | "unsupported" | "empty" | "download_failed";
export type CoreDownloadSuccess = {
  ok: true;
  bytes: Buffer;
  mimeType: string;
  category: MediaCategory;
  sizeBytes: number;
  sha256?: string;
};
export type CoreDownloadFailure = {
  ok: false;
  reason: CoreDownloadFailureReason;
  error: string;
  mimeType?: string;
  sizeBytes?: number;
  limitBytes?: number;
};
export type CoreDownloadResult = CoreDownloadSuccess | CoreDownloadFailure;

function fail(reason: CoreDownloadFailureReason, error: string, extra?: Partial<CoreDownloadFailure>): CoreDownloadFailure {
  return { ok: false, reason, error, ...extra };
}

/** Read a response body, aborting as soon as it exceeds `maxBytes`. */
export async function readCapped(response: Response, maxBytes: number): Promise<Buffer | "too_big"> {
  const declared = Number(response.headers.get("content-length") || "");
  if (Number.isFinite(declared) && declared > maxBytes) return "too_big";
  if (!response.body) {
    const whole = Buffer.from(await response.arrayBuffer());
    return whole.length > maxBytes ? "too_big" : whole;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return "too_big";
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}

/** MIME allowlist + size check on downloaded bytes. */
export function finalizeDownload(bytes: Buffer, mimeHint: string | undefined, maxBytes: number, sha256?: string): CoreDownloadResult {
  const check = checkInboundMedia({ mimeType: mimeHint, sizeBytes: bytes.length, maxBytes });
  if (!check.ok) {
    return fail(check.reason, `media rejected: ${check.reason}`, {
      mimeType: check.mimeType,
      sizeBytes: bytes.length,
      limitBytes: check.limitBytes,
    });
  }
  return { ok: true, bytes, mimeType: check.mimeType, category: check.category, sizeBytes: bytes.length, sha256 };
}

type MetaMediaMeta = { url?: string; mime_type?: string; file_size?: number | string; sha256?: string };

/**
 * Meta Cloud API media id → validated bytes: GET /{media-id} (Bearer) → { url, mime_type, file_size },
 * then GET url with the same Bearer token (the lookaside URL rejects anonymous requests). Never throws.
 */
export async function metaDownloadMedia(input: {
  mediaId: string;
  token: string;
  graphUrl: (path: string) => string;
  fetchImpl: FetchLike;
  mimeHint?: string;
  maxBytes?: number;
  timeoutMs?: number;
}): Promise<CoreDownloadResult> {
  const maxBytes = input.maxBytes ?? INBOUND_MAX_BYTES;
  const timeoutMs = input.timeoutMs ?? 30_000;
  if (!input.mediaId.trim()) return fail("download_failed", "empty media id");
  if (!input.token) return fail("download_failed", "WHATSAPP_ACCESS_TOKEN / WHATSAPP_TOKEN missing");

  if (input.mimeHint) {
    const pre = checkInboundMedia({ mimeType: input.mimeHint, maxBytes });
    if (!pre.ok) return fail(pre.reason, `media rejected: ${pre.reason}`, { mimeType: pre.mimeType });
  }

  let meta: MetaMediaMeta;
  try {
    const res = await input.fetchImpl(input.graphUrl(encodeURIComponent(input.mediaId)), {
      headers: { Authorization: `Bearer ${input.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return fail("download_failed", `Meta media metadata ${await graphErrorText(res)}`);
    meta = (await res.json()) as MetaMediaMeta;
  } catch (error) {
    return fail("download_failed", error instanceof Error ? error.message : "Meta media metadata failed");
  }
  if (!meta.url) return fail("download_failed", "Meta media metadata missing url");
  // The bearer token only ever goes to Meta's own media hosts (lookaside.fbsbx.com …).
  if (!isMetaMediaHost(meta.url)) return fail("download_failed", "Meta media url is not a Meta host");

  const mimeType = baseMime(meta.mime_type || input.mimeHint);
  const declaredSize = Number(meta.file_size);
  const pre = checkInboundMedia({
    mimeType,
    sizeBytes: Number.isFinite(declaredSize) && declaredSize > 0 ? declaredSize : undefined,
    maxBytes,
  });
  if (!pre.ok) {
    return fail(pre.reason, `media rejected: ${pre.reason}`, { mimeType: pre.mimeType, sizeBytes: pre.sizeBytes, limitBytes: pre.limitBytes });
  }

  try {
    const fileRes = await input.fetchImpl(meta.url, {
      headers: { Authorization: `Bearer ${input.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!fileRes.ok) return fail("download_failed", `Meta media download ${fileRes.status}`);
    const body = await readCapped(fileRes, maxBytes);
    if (body === "too_big") {
      return fail("too_big", "media exceeds size limit", { mimeType, limitBytes: maxBytes, sizeBytes: declaredSize || undefined });
    }
    return finalizeDownload(body, mimeType || fileRes.headers.get("content-type") || undefined, maxBytes, meta.sha256);
  } catch (error) {
    return fail("download_failed", error instanceof Error ? error.message : "Meta media download failed");
  }
}

/** POST /{phone-number-id}/media (multipart) → media id. Throws with a secret-free message. */
export async function metaUploadMedia(input: {
  cfg: GraphConfig;
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  fetchImpl: FetchLike;
}): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", input.mimeType);
  form.append("file", new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }), input.filename);
  const res = await input.fetchImpl(input.cfg.graphUrl(`${encodeURIComponent(input.cfg.phoneNumberId)}/media`), {
    method: "POST",
    headers: { Authorization: `Bearer ${input.cfg.token}` },
    body: form,
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Meta media upload ${await graphErrorText(res)}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Meta media upload returned no id");
  return json.id;
}

/** POST /{phone-number-id}/messages with a prepared payload → wamid. Throws with a secret-free message. */
export async function metaSendMessage(input: { cfg: GraphConfig; payload: unknown; fetchImpl: FetchLike }): Promise<string | undefined> {
  const res = await input.fetchImpl(input.cfg.graphUrl(`${encodeURIComponent(input.cfg.phoneNumberId)}/messages`), {
    method: "POST",
    headers: { Authorization: `Bearer ${input.cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input.payload),
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Meta WhatsApp ${await graphErrorText(res)}`);
  const json = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }> };
  return json.messages?.[0]?.id;
}

export function metaTextPayload(to: string, body: string) {
  return {
    messaging_product: "whatsapp" as const,
    recipient_type: "individual" as const,
    to: to.replace(/[^\d]/g, ""),
    type: "text" as const,
    text: { preview_url: false, body },
  };
}

/* ------------------------------------------------------------------ Gemini */

/** True when a Gemini failure is a quota / rate limit (HTTP 429, RESOURCE_EXHAUSTED). */
export function isGeminiQuotaError(error: unknown): boolean {
  if (!error) return false;
  const calls = (error as { calls?: Array<{ status?: number }> }).calls;
  if (Array.isArray(calls) && calls.length) {
    const statuses = calls.map((call) => call.status ?? 0);
    if (statuses.includes(429) && !statuses.includes(200)) return true;
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message);
}

/** WhatsApp voice notes are `audio/ogg; codecs=opus`: Gemini takes the base type. */
export function geminiAudioMime(mimeType: string | undefined): string {
  const base = baseMime(mimeType) || "audio/ogg";
  if (base === "audio/opus" || base === "application/ogg") return "audio/ogg";
  return base;
}

export type TranscribeResult = { ok: true; text: string; model: string } | { ok: false; quota: boolean; error: string };

const TRANSCRIBE_PROMPT =
  "Transcribe this WhatsApp voice note exactly as spoken. It may be Lebanese Arabic, Modern Standard Arabic, English or French, " +
  "often mixed, and may dictate a maths problem: keep numbers, variables and operations as spoken (you may write them as symbols, " +
  "e.g. x^2 - 5x + 6 = 0). Return ONLY the transcript text: no commentary, no quotes, no markdown. If nothing is audible, return an empty string.";

/** Gemini multimodal speech-to-text over an ordered model list (header key, never in the URL). Never throws. */
export async function geminiTranscribeAudio(input: {
  key: string;
  models: string[];
  bytes: Uint8Array;
  mimeType?: string;
  fetchImpl: FetchLike;
  timeoutMs?: number;
}): Promise<TranscribeResult> {
  if (!input.key) return { ok: false, quota: false, error: "GEMINI_API_KEY is not set" };
  if (!input.bytes.length) return { ok: false, quota: false, error: "empty audio" };
  const mime = geminiAudioMime(input.mimeType);
  const data = Buffer.from(input.bytes).toString("base64");
  let quota = false;
  let lastError = "Gemini speech-to-text failed";
  for (const model of input.models) {
    try {
      const res = await input.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": input.key },
          signal: AbortSignal.timeout(input.timeoutMs ?? 45_000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data } }, { text: TRANSCRIBE_PROMPT }] }],
            generationConfig: { temperature: 0 },
          }),
        },
      );
      if (!res.ok) {
        if (res.status === 429) quota = true;
        lastError = `Gemini STT ${model} ${res.status}`;
        await res.body?.cancel().catch(() => undefined);
        continue;
      }
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      const text = (json.candidates?.[0]?.content?.parts ?? [])
        .filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("\n")
        .trim();
      if (!text) {
        lastError = `Gemini STT ${model} returned an empty transcript`;
        continue;
      }
      if (/^(i (cannot|can't|am unable)|sorry|as an ai)/i.test(text) && text.length < 80) {
        lastError = `Gemini STT ${model} refused`;
        continue;
      }
      return { ok: true, text, model };
    } catch (error) {
      lastError = error instanceof Error ? `Gemini STT ${model}: ${error.message}` : `Gemini STT ${model} failed`;
    }
  }
  return { ok: false, quota, error: lastError };
}

/* ------------------------------------------------------------------ Replies (Arabic, signed محمد) */

export const QUOTA_APOLOGY_AR =
  "عذراً 🙏 خدمة الذكاء الاصطناعي وصلت لحدّها المسموح هلّق (Gemini quota)، فما قدرت جاوب على رسالتك.\n" +
  "جرّب تبعتها مرة تانية بعد كم دقيقة.\n" +
  MEDIA_SIGNATURE_AR;

export const STT_FAILED_AR =
  "🎙️ وصلتني المذكرة الصوتية بس ما قدرت إفهمها (تعذّر تفريغ الصوت).\n" +
  "ابعتها مرة تانية بصوت أوضح، أو اكتب السؤال كنص أو صوّره.\n" +
  MEDIA_SIGNATURE_AR;

export const VOICE_DOWNLOAD_FAILED_AR =
  "🎙️ وصلتني المذكرة الصوتية بس ما قدرت نزّلها من واتساب.\n" + "ابعتها مرة تانية بعد شوي، أو اكتب السؤال كنص.\n" + MEDIA_SIGNATURE_AR;

export const IMAGE_DOWNLOAD_FAILED_AR =
  "📸 وصلتني الصورة بس ما قدرت نزّلها من واتساب.\n" + "ابعتها مرة تانية، أو اكتب نص المسألة.\n" + MEDIA_SIGNATURE_AR;

export const SOLVE_FAILED_AR =
  "ما قدرت كمّل حلّ المسألة هلّق بسبب عطل تقني مؤقت.\n" + "ابعتها مرة تانية بعد شوي.\n" + MEDIA_SIGNATURE_AR;

/** Appended (before the signature) once the PDF document went out. */
export const PDF_SENT_AR = "📄 بعتتلك الحل كامل كمان كملف PDF (MathMentor · منذر حداره).";
/** The PDF was built but WhatsApp refused / failed the document send. */
export const PDF_SEND_FAILED_AR =
  "⚠️ ما قدرت إبعتلك ملف الـ PDF هلّق بسبب عطل تقني.\n" + "ابعتلي «PDF» بعد شوي وبرجع بعتلك ياه.";
/** The PDF itself could not be generated. */
export const PDF_BUILD_FAILED_AR =
  "⚠️ ما قدرت حضّر ملف الـ PDF هلّق — الحل كامل مكتوب فوق.\n" + "إذا بدّك ياه كملف، ابعتلي «PDF» بعد شوي.";
/** «PDF» asked on its own but there is no recent solution to send. */
export const PDF_NOTHING_TO_RESEND_AR =
  "📄 ما عندي حل جديد إبعتلك ياه كملف PDF.\n" + "ابعتلي المسألة (نص، صوت أو صورة) وبرجعلك بالحل مع ملف PDF.\n" + MEDIA_SIGNATURE_AR;

/** Put a status note just above the «— محمد …» signature (or at the end when there is none). */
export function withNoteBeforeSignature(text: string, note: string): string {
  if (!note) return text;
  const at = text.lastIndexOf(MEDIA_SIGNATURE_AR);
  if (at < 0) return `${text}\n${note}`;
  const head = text.slice(0, at).replace(/\s+$/, "");
  return `${head}\n${note}\n${text.slice(at)}`;
}

export const SOLVE_ACK_AR = "⏳ وصلتني المسألة، عم حلّها وإتحقّق منها… دقيقة وبرجعلك.";
export const MOCK_EXAM_ACK_AR = "⏳ عم حضّرلك امتحان تجريبي كملف PDF… لحظات.";

/**
 * WhatsApp answers stay personified as «محمد» (owner decision): the website tutor persona
 * (Dr. Mohamed / الدكتور محمد, Munzer's AI assistant) that the shared solver writes into correction
 * steps is renamed on this channel to the short WhatsApp voice «محمد». Badge / label forms are mapped;
 * a bare "Mohamed" / «محمد» already matching the channel voice is left alone. «الأستاذ منذر حداره» is untouched.
 */
export function whatsappPersonaText(text: string, options?: { latin?: boolean }): string {
  if (!text) return text;
  const en = options?.latin ? "Mohamed" : "محمد";
  return text
    .replace(/Dr\.?\s*Mohamed(?:\s*·\s*(?:Munzer's assistant|assistant de Munzer)|\s*\((?:AI tutor|tuteur IA)\)|\s*·\s*(?:AI tutor|tuteur IA))?/gi, en)
    .replace(/«?الدكتور محمد»?(?:\s*·\s*مساعد منذر|\s*\(معلّم بالذكاء الاصطناعي\)|\s*·\s*معلّم بالذكاء الاصطناعي)?/g, "محمد")
    .replace(/Youssef\s*(?:\(AI tutor\)|·\s*AI tutor)/g, en)
    .replace(/«?يوسف»?\s*(?:\(معلّم بالذكاء الاصطناعي\)|·\s*معلّم بالذكاء الاصطناعي)/g, "محمد");
}

/* ------------------------------------------------------------------ Maths detection */

const AR_SEP = "(?:^|[\\s،,.:;؛!؟?()«»\"'])";
const AR_END = "(?=$|[\\s،,.:;؛!؟?()«»\"'])";
/** Symbols / notation that only maths uses. */
const MATH_NOTATION = /[=^√∫∑∏≤≥≠±×÷∞π]|\d\s*[a-zA-Z]\b|\b[a-z]\s*\^|\b(sin|cos|tan|ln|log|lim|exp|sqrt|dx|dy)\b|\d+\s*[-+*/]\s*\d+|\bf\s*\(\s*x\s*\)/i;
/** Maths vocabulary (en / fr / ar, incl. Lebanese colloquial). */
const MATH_WORDS_LATIN =
  /\b(solve|equation|inequality|derivative|differentiate|integral|integrate|limit|prove|proof|factori[sz]e|simplify|probability|matrix|matrices|polynomial|function|calculate|compute|evaluate|expand|sequence|series|vector|logarithm|résou\w*|équation|inéquation|dérivée|intégrale|limite|démontr\w*|calcul\w*|fonction|suite|probabilité)\b/i;
const MATH_WORDS_AR = new RegExp(
  `${AR_SEP}(?:حل|حلّ|حلها|حلّها|حللي|حلّلي|حلي|حلّي|احسب|أحسب|احسبلي|معادلة|معادله|متراجحة|المعادلة|المتراجحة|مشتق|المشتق|المشتقة|اشتق|تكامل|التكامل|نهاية|النهاية|برهن|اثبت|أثبت|احتمال|الاحتمال|مصفوفة|دالة|الدالة|داله|جذر|كثير حدود|متتالية|المتتالية|لوغاريتم|مسألة|المسألة|مسأله|تمرين|التمرين)${AR_END}`,
);
/** Secretary / ops commands that must keep going to the intent pipeline. */
const OPS_WORDS = new RegExp(
  `${AR_SEP}(?:موعد|الموعد|ذكرني|ذكّرني|تذكير|فيديو|ريلز|حملة|تقرير|مدرسة|المدرسة|كود|الكود|المنصة|المنصه|الموجز|اجتماع|موافق|اعتمد|انشر|ارفض)${AR_END}|\\b(appointment|remind|reminder|video|reel|campaign|report|school|deploy|briefing|code|meeting)\\b`,
  "i",
);

/** A typed or transcribed message asks محمد to solve / explain a maths problem. */
export function looksLikeMathRequest(text: string | undefined): boolean {
  const t = (text || "").trim();
  if (t.length < 3) return false;
  const notation = MATH_NOTATION.test(t);
  const words = MATH_WORDS_LATIN.test(t) || MATH_WORDS_AR.test(t);
  if (!notation && !words) return false;
  if (OPS_WORDS.test(t) && !notation) return false;
  return true;
}

/** «ابعتلي ياه PDF» / "send it as a PDF": short, asks for a PDF, and is not a secretary / ops command. */
export function isBarePdfRequest(text: string | undefined): boolean {
  const t = (text || "").trim();
  if (!t || t.length > 80) return false;
  return wantsPdfReply(t) && !OPS_WORDS.test(t) && !looksLikeMathRequest(t);
}

/* ------------------------------------------------------------------ Turn orchestration */

export type MathSolveRequest = {
  question?: string;
  imageBase64?: string;
  mimeType?: string;
  imageName?: string;
  wantPdf: boolean;
  from: string;
};

export type ReplyAttachment = { bytes: Buffer; filename: string; caption: string; mimeType: string };

export type MathSolveOutcome =
  /** `pdfError`: a PDF was due but could not be generated (the student is told; text still goes out). */
  | { ok: true; textAr: string; pdf?: ReplyAttachment; pdfError?: string; relatedIds?: string[] }
  | { ok: false; reason: "quota" | "unavailable" | "failed"; textAr?: string; error?: string };

export type AgentReply = {
  to: string;
  textAr: string;
  status: "completed" | "failed";
  note: string;
  attachment?: ReplyAttachment;
  /** A PDF was due but could not be generated → the reply says so. */
  pdfError?: string;
  /** Status line appended when the attachment is delivered (default: none). */
  attachmentSentNoteAr?: string;
  replyToMessageId?: string;
  transcript?: string;
  relatedIds?: string[];
};

export type AgentTurnInput = {
  from: string;
  kind: "text" | "audio" | "image";
  text?: string;
  caption?: string;
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  filename?: string;
  messageId?: string;
};

export type AgentTurnDeps = {
  download: (input: { mediaId?: string; mediaUrl?: string; mimeHint?: string }) => Promise<CoreDownloadResult>;
  transcribe: (bytes: Buffer, mimeType: string) => Promise<TranscribeResult>;
  solve: (request: MathSolveRequest) => Promise<MathSolveOutcome>;
  mockExam?: (track: string | undefined) => Promise<{ bytes: Buffer; filename: string; captionAr: string }>;
  reply: (reply: AgentReply) => Promise<void>;
  /** Non-maths text / transcripts (appointments, reminders, briefings…) → the intent pipeline. */
  fallback: (input: { text: string; fromVoice: boolean }) => Promise<void>;
  ack?: (to: string, textAr: string) => Promise<void>;
  /** Latest solution PDF sent to this number (for a bare «ابعتلي ياه PDF»). */
  lastPdf?: (from: string) => ReplyAttachment | undefined;
  /** Persist an inbound photo for Agent Hub (best effort). */
  storeInbound?: (file: { bytes: Buffer; mimeType: string; filename?: string; caption?: string; mediaId?: string; messageId?: string }) => Promise<string | undefined>;
  log?: (level: "info" | "warn" | "error", message: string) => void;
};

export type AgentTurnRoute = "math" | "mock_exam" | "pdf_resend" | "fallback" | "stt_failed" | "quota" | "download_failed" | "empty";
export type AgentTurnResult = { route: AgentTurnRoute; transcript?: string; ok: boolean };

function heardLine(transcript: string): string {
  const short = transcript.replace(/\s+/g, " ").trim();
  return `🎙️ فهمت من المذكرة: «${short.length > 220 ? `${short.slice(0, 220)}…` : short}»`;
}

async function safeAck(deps: AgentTurnDeps, to: string, text: string) {
  try {
    await deps.ack?.(to, text);
  } catch {
    /* acks are best effort */
  }
}

/** Solve (photo and/or text) with the upgraded solver and reply; quota → short apology. Never throws. */
export async function answerMath(
  request: MathSolveRequest,
  deps: Pick<AgentTurnDeps, "solve" | "reply" | "log">,
  context: { messageId?: string; transcript?: string; note: string },
): Promise<boolean> {
  let outcome: MathSolveOutcome;
  try {
    outcome = await deps.solve(request);
  } catch (error) {
    const quota = isGeminiQuotaError(error);
    outcome = { ok: false, reason: quota ? "quota" : "failed", error: error instanceof Error ? error.message : "solver failed" };
  }
  const prefix = context.transcript ? `${heardLine(context.transcript)}\n\n` : "";
  if (outcome.ok) {
    if (request.wantPdf && !outcome.pdf) {
      deps.log?.("error", `[whatsapp-agent] solution PDF missing: ${outcome.pdfError ?? "solver returned no PDF"}`.slice(0, 300));
    }
    await deps.reply({
      to: request.from,
      textAr: `${prefix}${outcome.textAr}`,
      status: "completed",
      note: context.note,
      attachment: outcome.pdf,
      attachmentSentNoteAr: outcome.pdf ? PDF_SENT_AR : undefined,
      pdfError: request.wantPdf && !outcome.pdf ? outcome.pdfError ?? "pdf_missing" : undefined,
      replyToMessageId: context.messageId,
      transcript: context.transcript,
      relatedIds: outcome.relatedIds,
    });
    return true;
  }
  if (outcome.reason === "quota") {
    deps.log?.("error", `[whatsapp-agent] Gemini quota exhausted (429) while solving: ${outcome.error ?? ""}`.slice(0, 300));
  } else {
    deps.log?.("warn", `[whatsapp-agent] solve ${outcome.reason}: ${outcome.error ?? ""}`.slice(0, 300));
  }
  await deps.reply({
    to: request.from,
    textAr: outcome.reason === "quota" ? `${prefix}${QUOTA_APOLOGY_AR}` : `${prefix}${outcome.textAr || SOLVE_FAILED_AR}`,
    status: "failed",
    note: `${context.note}_${outcome.reason}`,
    replyToMessageId: context.messageId,
    transcript: context.transcript,
  });
  return false;
}

/**
 * One inbound WhatsApp message from the instructor (text, voice note or photo).
 * Voice: download → transcribe → handled exactly like typed text. Photo: download → solve.
 * Text: mock exam → PDF; maths → solver (+ PDF when asked); anything else → intent pipeline.
 * Every branch replies (never silent). Never throws.
 */
export async function runAgentTurn(input: AgentTurnInput, deps: AgentTurnDeps): Promise<AgentTurnResult> {
  const to = input.from;
  try {
    if (input.kind === "image") {
      const downloaded = await deps.download({ mediaId: input.mediaId, mediaUrl: input.mediaUrl, mimeHint: input.mimeType });
      if (!downloaded.ok) {
        deps.log?.("warn", `[whatsapp-agent] image download failed: ${downloaded.error}`.slice(0, 300));
        await deps.reply({ to, textAr: IMAGE_DOWNLOAD_FAILED_AR, status: "failed", note: "whatsapp_image_download_failed", replyToMessageId: input.messageId });
        return { route: "download_failed", ok: false };
      }
      let recordId: string | undefined;
      try {
        recordId = await deps.storeInbound?.({
          bytes: downloaded.bytes,
          mimeType: downloaded.mimeType,
          filename: input.filename,
          caption: input.caption,
          mediaId: input.mediaId,
          messageId: input.messageId,
        });
      } catch {
        recordId = undefined;
      }
      await safeAck(deps, to, SOLVE_ACK_AR);
      const ok = await answerMath(
        {
          question: input.caption,
          imageBase64: downloaded.bytes.toString("base64"),
          mimeType: downloaded.mimeType,
          imageName: input.filename || recordId,
          wantPdf: shouldSendPdf(input.caption),
          from: to,
        },
        deps,
        { messageId: input.messageId, note: "whatsapp_image_solve" },
      );
      return { route: "math", ok };
    }

    let text = (input.text || "").trim();
    let transcript: string | undefined;
    if (input.kind === "audio") {
      const downloaded = await deps.download({ mediaId: input.mediaId, mediaUrl: input.mediaUrl, mimeHint: input.mimeType });
      if (!downloaded.ok) {
        deps.log?.("warn", `[whatsapp-agent] voice download failed: ${downloaded.error}`.slice(0, 300));
        await deps.reply({ to, textAr: VOICE_DOWNLOAD_FAILED_AR, status: "failed", note: "whatsapp_voice_download_failed", replyToMessageId: input.messageId });
        return { route: "download_failed", ok: false };
      }
      const stt = await deps.transcribe(downloaded.bytes, downloaded.mimeType || input.mimeType || "audio/ogg");
      if (!stt.ok) {
        if (stt.quota) {
          deps.log?.("error", `[whatsapp-agent] Gemini quota exhausted (429) during voice transcription: ${stt.error}`.slice(0, 300));
          await deps.reply({ to, textAr: QUOTA_APOLOGY_AR, status: "failed", note: "whatsapp_voice_quota", replyToMessageId: input.messageId });
          return { route: "quota", ok: false };
        }
        deps.log?.("warn", `[whatsapp-agent] voice transcription failed: ${stt.error}`.slice(0, 300));
        await deps.reply({ to, textAr: STT_FAILED_AR, status: "failed", note: "whatsapp_voice_stt_failed", replyToMessageId: input.messageId });
        return { route: "stt_failed", ok: false };
      }
      text = stt.text.trim();
      transcript = text;
    }

    if (!text) {
      await deps.reply({ to, textAr: STT_FAILED_AR, status: "failed", note: "whatsapp_empty_message", replyToMessageId: input.messageId });
      return { route: "empty", ok: false };
    }

    const mock = parseMockExamRequest(text);
    if (mock.matched && deps.mockExam) {
      await safeAck(deps, to, MOCK_EXAM_ACK_AR);
      try {
        const exam = await deps.mockExam(mock.track);
        await deps.reply({
          to,
          textAr: `${transcript ? `${heardLine(transcript)}\n\n` : ""}${exam.captionAr}`,
          status: "completed",
          note: "whatsapp_mock_exam_pdf",
          attachmentSentNoteAr: "📄 الملف مرفق.",
          attachment: { bytes: exam.bytes, filename: exam.filename, caption: exam.captionAr, mimeType: "application/pdf" },
          replyToMessageId: input.messageId,
          transcript,
        });
        return { route: "mock_exam", transcript, ok: true };
      } catch (error) {
        const quota = isGeminiQuotaError(error);
        deps.log?.(quota ? "error" : "warn", `[whatsapp-agent] mock exam failed: ${error instanceof Error ? error.message : "error"}`.slice(0, 300));
        await deps.reply({ to, textAr: quota ? QUOTA_APOLOGY_AR : SOLVE_FAILED_AR, status: "failed", note: "whatsapp_mock_exam_failed", replyToMessageId: input.messageId });
        return { route: quota ? "quota" : "mock_exam", transcript, ok: false };
      }
    }

    if (looksLikeMathRequest(text)) {
      await safeAck(deps, to, SOLVE_ACK_AR);
      const ok = await answerMath(
        { question: text, wantPdf: shouldSendPdf(text), from: to },
        deps,
        { messageId: input.messageId, transcript, note: transcript ? "whatsapp_voice_solve" : "whatsapp_text_solve" },
      );
      return { route: "math", transcript, ok };
    }

    // «ابعتلي ياه PDF» on its own → the latest solution PDF again (never the intent pipeline).
    if (isBarePdfRequest(text) && deps.lastPdf) {
      const last = deps.lastPdf(to);
      await deps.reply({
        to,
        textAr: last
          ? `${transcript ? `${heardLine(transcript)}\n\n` : ""}📄 هيدا آخر ملف PDF حضّرتلك ياه.\n${MEDIA_SIGNATURE_AR}`
          : PDF_NOTHING_TO_RESEND_AR,
        status: last ? "completed" : "failed",
        note: last ? "whatsapp_pdf_resend" : "whatsapp_pdf_resend_none",
        attachment: last,
        replyToMessageId: input.messageId,
        transcript,
      });
      return { route: "pdf_resend", transcript, ok: Boolean(last) };
    }

    await deps.fallback({ text, fromVoice: Boolean(transcript) });
    return { route: "fallback", transcript, ok: true };
  } catch (error) {
    deps.log?.("error", `[whatsapp-agent] turn failed: ${error instanceof Error ? error.message : "error"}`.slice(0, 300));
    try {
      await deps.reply({
        to,
        textAr: isGeminiQuotaError(error) ? QUOTA_APOLOGY_AR : SOLVE_FAILED_AR,
        status: "failed",
        note: "whatsapp_turn_error",
        replyToMessageId: input.messageId,
      });
    } catch {
      /* nothing left to do */
    }
    return { route: "fallback", ok: false };
  }
}
