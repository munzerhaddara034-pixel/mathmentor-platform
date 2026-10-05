import { NextResponse } from "next/server";
import {
  inboundProvenance,
  publicUrlCandidates,
  UNVERIFIED_PRIVILEGED_REFUSAL_AR,
  warnOnce,
  type ProvenanceDecision,
} from "@/lib/security/webhookProvenance";
import { createId } from "@/lib/ids";
import { configuredVerifyToken, decideMetaVerification, isVerificationAttempt, logVerificationFailure } from "@/lib/whatsapp/verifyToken";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import { latestHealth } from "@/lib/agent/store";
import { runWhatsAppVoicePipeline } from "@/lib/agent/voicePipeline";
import {
  handleApprovalInboundText,
  appendRevisionNote,
  isApprovalCommand,
  isRejectCommand,
  listAwaitingApprovals,
} from "@/lib/agent/approvalWorkflow";
import {
  sendAgentWhatsAppConfirmation,
  sendUnauthorizedAgentReply,
  UNAUTHORIZED_AGENT_WA_AR,
} from "@/lib/agent/whatsappSender";
import {
  instructorWhatsAppNumber,
  isAuthorizedInstructorPhone,
  normalizeWhatsAppDigits,
} from "@/lib/whatsapp/adapter";
import { categoryForMime, type InboundMediaKind } from "@/lib/whatsapp/media/policy";
import { parseMockExamRequest } from "@/lib/agent/media/captionIntent";
import { dispatchInboundMedia, dispatchMockExam } from "@/lib/agent/media/dispatch";
import { sendMediaAck } from "@/lib/agent/media/reply";
import { dispatchAgentTurn } from "@/lib/agent/media/whatsappAgent";

function webhookSecretFrom(request: Request): string | null {
  const header = request.headers.get("x-webhook-secret");
  if (header) return header;
  try {
    return new URL(request.url).searchParams.get("secret");
  } catch {
    return null;
  }
}

/** Provider authenticity for inbound webhooks (Meta HMAC / Twilio HMAC / UltraMsg shared secret). */
function provenanceFor(
  request: Request,
  source: "meta" | "ultramsg" | "twilio",
  rawBody: string | null,
  twilioParams: Array<[string, string]> = [],
): ProvenanceDecision {
  const decision = inboundProvenance({
    source,
    provider: (process.env.WHATSAPP_PROVIDER || "meta").trim().toLowerCase(),
    rawBody,
    metaSignatureHeader: request.headers.get("x-hub-signature-256"),
    appSecret: process.env.WHATSAPP_APP_SECRET,
    twilio: {
      authToken: process.env.TWILIO_AUTH_TOKEN,
      urls: publicUrlCandidates(request.url, request.headers, process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL),
      params: twilioParams,
      signatureHeader: request.headers.get("x-twilio-signature"),
    },
    ultramsg: {
      provided: webhookSecretFrom(request),
      dedicatedSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
      fallbackSecret: process.env.AGENT_WEBHOOK_SECRET,
    },
  });
  if (decision.ok && decision.warning) warnOnce(decision.warning);
  return decision;
}

/**
 * Non-maths instructor text / transcripts → intent pipeline (appointments, reminders, briefings…),
 * WhatsApp confirmation first, Agent Hub task after. Runs in the background for webhooks.
 */
async function pipelineAndConfirm(input: { text: string; fromVoice: boolean; senderDigits: string; privileged: boolean }) {
  const { task, campaign, schoolReport, stagedApproval } = await runWhatsAppVoicePipeline({
    transcript: input.text,
    senderPhone: input.senderDigits,
    persist: false,
  });
  if (input.fromVoice) task.transcriptSource = "whisper";
  if (input.privileged && task.whisperTranscript?.trim() && !stagedApproval) {
    const awaiting = await listAwaitingApprovals(3);
    if (awaiting[0] && task.intent.kind === "general_task" && /عدّل|عدل|غيّر|غير|edit|revise|change/i.test(task.whisperTranscript)) {
      await appendRevisionNote(awaiting[0].id, task.whisperTranscript.slice(0, 400));
    }
  }
  const health = task.intent.kind === "platform_health" ? await latestHealth() : null;
  await sendAgentWhatsAppConfirmation({ to: input.senderDigits, task, campaign, schoolReport, health });
}

export const runtime = "nodejs";
export const maxDuration = 60;

const VOICE_MIME_HINT = /audio\/(ogg|mpeg|mp4|aac|amr|webm|opus)|video\/mp4|ogg|opus|ptt/i;

type InboundParsed = {
  source: "meta" | "ultramsg" | "twilio" | "staff" | "unknown";
  senderPhone?: string;
  textBody?: string;
  mediaUrl?: string;
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  bytes?: Buffer;
  demo?: boolean;
  /** Meta/UltraMsg/Twilio message type when known (text|audio|image|…). */
  messageType?: string;
  /** Non-audio media (image/document/video/sticker) → media handler instead of the voice pipeline. */
  mediaKind?: InboundMediaKind;
  caption?: string;
  /** Provider message id (Meta wamid) — dedupe + reply context. */
  messageId?: string;
  isWebhookStyle: boolean;
};

const META_MEDIA_TYPES = new Set(["image", "document", "video", "sticker"]);

/**
 * Non-audio media kind for a MIME (staff uploads / Twilio). Voice-like MIMEs (incl. video/mp4
 * recordings) stay on the voice pipeline. `strict` (staff uploads) only routes allow-listed types;
 * otherwise unknown image/application types are routed so the sender gets a clear "unsupported" reply.
 */
function mediaKindForMime(mimeType: string | undefined, strict = false): InboundMediaKind | undefined {
  if (!mimeType || VOICE_MIME_HINT.test(mimeType)) return undefined;
  const category = categoryForMime(mimeType);
  if (category === "image" || category === "document" || category === "video") return category;
  if (strict) return undefined;
  if (/^image\//i.test(mimeType)) return "image";
  if (/^(application|text)\//i.test(mimeType)) return "document";
  return undefined;
}

function asMediaKind(type: string): InboundMediaKind | undefined {
  return type === "image" || type === "document" || type === "video" || type === "sticker" ? type : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function parseMetaPayload(body: Record<string, unknown>): InboundParsed | null {
  if (body.object !== "whatsapp_business_account" && !Array.isArray(body.entry)) return null;
  const entry = Array.isArray(body.entry) ? body.entry : [];
  for (const ent of entry) {
    const e = asRecord(ent);
    const changes = e && Array.isArray(e.changes) ? e.changes : [];
    for (const ch of changes) {
      const c = asRecord(ch);
      const value = asRecord(c?.value);
      const messages = value && Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        const m = asRecord(msg);
        if (!m) continue;
        const senderPhone = pickString(m.from);
        const type = pickString(m.type)?.toLowerCase() || "";
        const messageId = pickString(m.id);
        const mediaObj = META_MEDIA_TYPES.has(type) ? asRecord(m[type]) : null;
        const mediaMime = pickString(mediaObj?.mime_type, mediaObj?.mimeType);
        // Documents that are really audio files keep the legacy voice path.
        const audioAsDocument = type === "document" && Boolean(mediaMime && /^audio\//i.test(mediaMime));
        if (mediaObj && !audioAsDocument) {
          return {
            source: "meta",
            senderPhone,
            mediaKind: asMediaKind(type),
            mediaId: pickString(mediaObj.id),
            mimeType: mediaMime,
            filename: pickString(mediaObj.filename),
            caption: pickString(mediaObj.caption),
            messageId,
            messageType: type,
            isWebhookStyle: true,
          };
        }
        const textObj = asRecord(m.text);
        const interactiveObj = asRecord(m.interactive);
        const buttonReply = asRecord(interactiveObj?.button_reply) || asRecord(interactiveObj?.list_reply);
        const audioObj = asRecord(m.audio) || asRecord(m.voice) || asRecord(m.document);
        // Interactive reply buttons: prefer the button id (level_middle) so parseLevelChoice can match it.
        const textBody = pickString(
          buttonReply ? pickString(buttonReply.id, buttonReply.title) : undefined,
          textObj?.body,
          m.body,
        );
        const mediaId = pickString(audioObj?.id);
        const mimeType = pickString(audioObj?.mime_type, audioObj?.mimeType);
        const isAudio =
          type === "audio" ||
          type === "voice" ||
          Boolean(audioObj) ||
          (mimeType ? VOICE_MIME_HINT.test(mimeType) : false);
        return {
          source: "meta",
          senderPhone,
          textBody,
          messageId,
          mediaId: isAudio ? (pickString(audioObj?.id) || undefined) : undefined,
          mimeType: mimeType || (isAudio ? "audio/ogg" : undefined),
          filename: isAudio ? "voice.ogg" : undefined,
          messageType: type || (isAudio ? "audio" : textBody ? "text" : undefined),
          isWebhookStyle: true,
        };
      }
    }
  }
  // Status-only webhooks — acknowledge without pipeline
  return {
    source: "meta",
    isWebhookStyle: true,
  };
}

function parseUltraMsgPayload(body: Record<string, unknown>): InboundParsed | null {
  const data = asRecord(body.data) || body;
  const eventType = pickString(body.event_type, body.eventType, data.event_type);
  const from = pickString(data.from, body.from, data.author, body.author);
  const bodyText = pickString(data.body, body.body, data.text, body.text);
  const type = pickString(data.type, body.type)?.toLowerCase() || "";
  const mediaUrl = pickString(data.media, data.mediaUrl, body.media, body.mediaUrl, data.media_url);
  const looksUltra =
    Boolean(from) &&
    (Boolean(eventType) ||
      "instanceId" in body ||
      "token" in body ||
      type === "ptt" ||
      type === "audio" ||
      type === "chat" ||
      Boolean(asRecord(body.data)));
  if (!looksUltra) return null;
  const ultraMediaKind = asMediaKind(type);
  if (ultraMediaKind && mediaUrl) {
    const caption = pickString(data.caption, body.caption) || (bodyText && !/^https?:\/\//i.test(bodyText) ? bodyText : undefined);
    return {
      source: "ultramsg",
      senderPhone: from,
      mediaKind: ultraMediaKind,
      mediaUrl,
      mimeType: pickString(data.mimetype, data.mimeType, data.mime_type),
      filename: pickString(data.filename, body.filename),
      caption,
      messageId: pickString(data.id, body.id),
      messageType: type,
      isWebhookStyle: true,
    };
  }
  const isAudio = type === "ptt" || type === "audio" || type === "voice" || Boolean(mediaUrl && !bodyText);
  return {
    source: "ultramsg",
    senderPhone: from,
    textBody: bodyText,
    mediaUrl: isAudio || mediaUrl ? mediaUrl : undefined,
    mimeType: isAudio ? "audio/ogg" : undefined,
    filename: isAudio ? "ultramsg-voice.ogg" : undefined,
    messageType: type || (isAudio ? "audio" : bodyText ? "chat" : undefined),
    isWebhookStyle: true,
  };
}

function parseTwilioForm(form: FormData): InboundParsed | null {
  const from = pickString(form.get("From"), form.get("WaId"), form.get("Caller"));
  const bodyText = pickString(form.get("Body"), form.get("body"));
  const mediaUrl = pickString(form.get("MediaUrl0"), form.get("MediaUrl"), form.get("mediaUrl"));
  const mimeType = pickString(form.get("MediaContentType0"), form.get("mimeType"));
  if (!from && !mediaUrl && !bodyText) return null;
  const twilioMediaKind = mediaUrl ? mediaKindForMime(mimeType) : undefined;
  if (twilioMediaKind) {
    return {
      source: "twilio",
      senderPhone: from?.replace(/^whatsapp:/i, ""),
      mediaKind: twilioMediaKind,
      mediaUrl,
      mimeType,
      caption: bodyText,
      messageId: pickString(form.get("MessageSid")),
      messageType: twilioMediaKind,
      isWebhookStyle: true,
    };
  }
  const numMedia = Number(pickString(form.get("NumMedia")) || "0");
  const isAudio =
    numMedia > 0 ||
    Boolean(mediaUrl) ||
    (mimeType ? VOICE_MIME_HINT.test(mimeType) : false);
  return {
    source: "twilio",
    senderPhone: from?.replace(/^whatsapp:/i, ""),
    textBody: bodyText,
    mediaUrl: mediaUrl,
    mimeType: mimeType || (isAudio ? "audio/ogg" : undefined),
    filename: isAudio ? "twilio-voice.ogg" : undefined,
    messageType: isAudio ? "audio" : bodyText ? "text" : undefined,
    isWebhookStyle: true,
  };
}

async function parseStaffMultipart(form: FormData): Promise<InboundParsed> {
  const file = form.get("file") ?? form.get("audio") ?? form.get("voice");
  let bytes: Buffer | undefined;
  let filename: string | undefined;
  let mimeType: string | undefined;
  if (file && typeof file !== "string") {
    const blob = file as File;
    filename = blob.name || "voice.webm";
    mimeType = blob.type || undefined;
    bytes = Buffer.from(await blob.arrayBuffer());
  }
  const mimeField = form.get("mimeType") ?? form.get("mime");
  if (!mimeType && typeof mimeField === "string" && mimeField.trim()) {
    mimeType = mimeField.trim();
  }
  const mediaUrl = pickString(form.get("mediaUrl"), form.get("media_url"));
  const mediaId = pickString(form.get("mediaId"), form.get("media_id"));
  const transcript = pickString(form.get("transcript"), form.get("text"), form.get("body"));
  const senderPhone = pickString(form.get("from"), form.get("sender"), form.get("phone"));
  const demoField = form.get("demo");
  const demo = demoField === "1" || demoField === "true";
  const mediaKind = bytes ? mediaKindForMime(mimeType, true) : undefined;
  return {
    source: "staff",
    senderPhone,
    mediaKind,
    caption: mediaKind ? pickString(form.get("caption"), transcript) : undefined,
    textBody: mediaKind ? undefined : transcript,
    mediaUrl,
    mediaId,
    mimeType,
    filename,
    bytes,
    demo,
    isWebhookStyle: false,
  };
}

function parseStaffJson(body: Record<string, unknown>): InboundParsed {
  const fileBase64 = pickString(body.fileBase64);
  const fileMime = pickString(body.mimeType, body.mime_type);
  const fileKind = fileBase64 ? mediaKindForMime(fileMime, true) : undefined;
  if (fileBase64 && fileKind) {
    let fileBytes: Buffer | undefined;
    try {
      fileBytes = Buffer.from(fileBase64, "base64");
    } catch {
      fileBytes = undefined;
    }
    return {
      source: "staff",
      senderPhone: pickString(body.from, body.sender, body.phone, body.senderPhone),
      mediaKind: fileKind,
      bytes: fileBytes,
      mimeType: fileMime,
      filename: pickString(body.filename),
      caption: pickString(body.caption, body.text),
      isWebhookStyle: false,
    };
  }
  const audioBase64 = pickString(body.audioBase64);
  let bytes: Buffer | undefined;
  if (audioBase64) {
    try {
      bytes = Buffer.from(audioBase64, "base64");
    } catch {
      bytes = undefined;
    }
  }
  return {
    source: "staff",
    senderPhone: pickString(body.from, body.sender, body.phone, body.senderPhone),
    textBody: pickString(body.transcript, body.text, body.body),
    mediaUrl: pickString(body.mediaUrl, body.media_url),
    mediaId: pickString(body.mediaId, body.media_id),
    mimeType: pickString(body.mimeType, body.mime_type),
    filename: pickString(body.filename),
    bytes,
    demo: Boolean(body.demo),
    isWebhookStyle: false,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (isVerificationAttempt(url.searchParams)) {
    // Meta webhook verification: token only from WHATSAPP_VERIFY_TOKEN (no hardcoded fallback).
    const decision = decideMetaVerification(url.searchParams);
    if (decision.ok) {
      return new NextResponse(decision.challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    logVerificationFailure("/api/agent/whatsapp-voice", decision.reason);
    return new NextResponse("Verification failed", { status: 403 });
  }

  // Plain GET (health probe / setup assistant self-ping). Never expose phone numbers or allowlists.
  const body: Record<string, unknown> = { ok: true, endpoint: "agent-whatsapp-voice" };
  const auth = await authorizeAgentRequest(request).catch(() => null);
  if (auth?.ok && (auth.mode === "staff" || auth.mode === "secret")) {
    body.verify = {
      modeParam: "hub.mode=subscribe",
      tokenEnv: "WHATSAPP_VERIFY_TOKEN",
      tokenConfigured: Boolean(configuredVerifyToken()),
      challengeParam: "hub.challenge",
    };
    body.accepts = [
      "Meta Cloud API webhook (GET verify + POST messages)",
      "UltraMsg-style JSON webhook",
      "Twilio WhatsApp form posts",
      "Staff multipart / JSON from Agent Hub",
    ];
  }
  return NextResponse.json(body);
}

export async function POST(request: Request) {
  let senderDigits: string | undefined;
  let parsedSource: InboundParsed["source"] = "unknown";
  let isWebhook = false;

  try {
    const contentType = request.headers.get("content-type") || "";
    let parsed: InboundParsed;
    /** True only for a cryptographically verified webhook (or an authorized staff call). */
    let privileged = false;

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      const twilio = parseTwilioForm(form);
      // Twilio webhook vs staff multipart: Twilio has From/WaId; staff has file fields
      const hasStaffFile = Boolean(form.get("file") || form.get("audio") || form.get("voice"));
      if (twilio && !hasStaffFile && twilio.isWebhookStyle) {
        const params: Array<[string, string]> = [];
        for (const [key, value] of form.entries()) if (typeof value === "string") params.push([key, value]);
        const provenance = provenanceFor(request, "twilio", null, params);
        if (!provenance.ok) return NextResponse.json({ ok: false, error: provenance.error }, { status: provenance.status });
        privileged = provenance.privileged;
        parsed = twilio;
      } else {
        parsed = await parseStaffMultipart(form);
        if (twilio?.senderPhone && !parsed.senderPhone) {
          parsed = { ...parsed, senderPhone: twilio.senderPhone };
        }
      }
    } else {
      let body: Record<string, unknown>;
      let rawBody = "";
      try {
        rawBody = await request.text();
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON or multipart body." }, { status: 400 });
      }
      const meta = parseMetaPayload(body);
      const ultra = meta ? null : parseUltraMsgPayload(body);
      // Meta signs every webhook (X-Hub-Signature-256); Twilio signs with X-Twilio-Signature;
      // UltraMsg carries a shared secret. Forged "from the instructor's phone" payloads are rejected
      // (when the provider's secret is configured) or at least never get privileged actions.
      if (meta || ultra || request.headers.get("x-hub-signature-256")) {
        const provenance = provenanceFor(request, meta ? "meta" : "ultramsg", rawBody);
        if (!provenance.ok) return NextResponse.json({ ok: false, error: provenance.error }, { status: provenance.status });
        privileged = provenance.privileged;
      }
      if (meta && (meta.senderPhone || meta.mediaId || meta.textBody || meta.source === "meta")) {
        // Empty status callbacks: ACK quickly (no phone / no content)
        if (!meta.senderPhone && !meta.mediaId && !meta.textBody && !meta.mediaUrl && !meta.mediaKind) {
          return NextResponse.json({ ok: true, ignored: "meta_status_or_empty" });
        }
        parsed = meta;
      } else if (ultra) {
        parsed = ultra;
      } else {
        parsed = parseStaffJson(body);
      }
    }

    parsedSource = parsed.source;
    isWebhook = parsed.isWebhookStyle;

    // Webhooks are phone-gated; staff/hub requires agent auth (or demo when secrets empty).
    if (!parsed.isWebhookStyle) {
      const auth = await authorizeAgentRequest(request);
      if (!auth.ok) return auth.error;
      privileged = auth.mode !== "demo";
    }

    senderDigits = parsed.senderPhone
      ? normalizeWhatsAppDigits(parsed.senderPhone)
      : undefined;

    if (parsed.isWebhookStyle && senderDigits) {
      if (!isAuthorizedInstructorPhone(senderDigits)) {
        const outbound = await sendUnauthorizedAgentReply(senderDigits);
        return NextResponse.json({
          ok: false,
          unauthorized: true,
          errorAr: UNAUTHORIZED_AGENT_WA_AR,
          outbound,
        });
      }
    }

    // Image / document / video (sticker ignored) → media handler (download, store, act, reply).
    if (parsed.mediaKind && parsed.mediaKind !== "audio") {
      if (parsed.mediaKind === "sticker") {
        return NextResponse.json({ ok: true, source: parsed.source, ignored: "sticker" });
      }
      // Webhook senders are already allowlist-gated above; staff uploads always reply to the instructor.
      const from =
        senderDigits && (parsed.isWebhookStyle || isAuthorizedInstructorPhone(senderDigits))
          ? senderDigits
          : instructorWhatsAppNumber();
      const dispatched = await dispatchInboundMedia(
        {
          provider: parsed.source,
          from,
          kind: parsed.mediaKind,
          mediaId: parsed.mediaId,
          mediaUrl: parsed.mediaUrl,
          bytes: parsed.bytes,
          mimeType: parsed.mimeType,
          filename: parsed.filename,
          caption: parsed.caption,
          messageId: parsed.messageId,
        },
        parsed.isWebhookStyle,
      );
      if (dispatched.mode === "background") {
        return NextResponse.json({
          ok: true,
          source: parsed.source,
          accepted: "media",
          mediaKind: parsed.mediaKind,
          duplicate: Boolean(dispatched.duplicate),
        });
      }
      const result = dispatched.result;
      return NextResponse.json({
        ok: result.ok,
        source: parsed.source,
        mediaKind: parsed.mediaKind,
        action: result.action ?? null,
        mediaRecord: result.record ?? null,
        task: result.reply?.task ?? null,
        whatsappReply: result.reply?.task.automatedReplyText ?? null,
        outboundWhatsApp: result.reply?.outbound ?? null,
        attachment: result.reply?.attachment ?? null,
        error: result.error ?? null,
      });
    }

    let transcript = parsed.textBody;
    let demo = Boolean(parsed.demo);
    let bytes = parsed.bytes;
    const mediaUrl = parsed.mediaUrl;
    const mediaId = parsed.mediaId;
    const filename = parsed.filename;
    const mimeType = parsed.mimeType;

    // Unverified webhook (provider secret not configured): no approvals over WhatsApp.
    if (
      !privileged &&
      parsed.isWebhookStyle &&
      senderDigits &&
      isAuthorizedInstructorPhone(senderDigits) &&
      transcript &&
      !mediaId &&
      !mediaUrl &&
      !bytes &&
      (isApprovalCommand(transcript) || isRejectCommand(transcript))
    ) {
      console.warn("[mathmentor] approval command over an unverified webhook refused (set WHATSAPP_APP_SECRET).");
      await sendMediaAck(senderDigits, UNVERIFIED_PRIVILEGED_REFUSAL_AR);
      return NextResponse.json({ ok: false, source: parsed.source, refused: "unverified_webhook_approval" });
    }

    // Approval listener: موافق / اعتمد / انشر → DEPLOYED (never auto-deploy without this).
    if (
      privileged &&
      parsed.isWebhookStyle &&
      senderDigits &&
      isAuthorizedInstructorPhone(senderDigits) &&
      transcript &&
      !mediaId &&
      !mediaUrl &&
      !bytes
    ) {
      const decision = await handleApprovalInboundText({
        text: transcript,
        senderPhone: senderDigits,
      });
      if (decision.handled) {
        // approveAndDeploy / reject already WhatsApp-notified when an item existed.
        // Persist voice task AFTER that outbound (hub appears second). Skip second WA if already notified.
        const now = new Date().toISOString();
        const alreadyNotified = Boolean(decision.item) && (decision.action === "approve" || decision.action === "reject");
        const task = {
          id: createId("wavtask"),
          audioLog: { receivedAt: now, senderPhone: senderDigits },
          whisperTranscript: transcript,
          transcriptSource: "typed" as const,
          intent: {
            kind: "general_task" as const,
            confidence: 1,
            parameters: {
              note: decision.action === "approve" ? "approval_deploy" : decision.action === "reject" ? "approval_reject" : "approval_none",
              approvalId: decision.item?.id ?? null,
            },
            source: "heuristic" as const,
          },
          status: decision.action === "approve" ? ("completed" as const) : ("queued" as const),
          automatedReplyText: decision.replyAr,
          relatedIds: decision.item ? [decision.item.id] : [],
          createdAt: now,
          updatedAt: now,
          outboundWhatsApp: alreadyNotified
            ? {
                status: "sent" as const,
                provider: "meta",
                to: `+${senderDigits}`,
                at: now,
              }
            : undefined,
        };
        const { replyAr, outbound, task: taskWithOutbound } = alreadyNotified
          ? await (async () => {
              const { saveVoiceTask } = await import("@/lib/agent/store");
              const saved = await saveVoiceTask(task);
              return {
                replyAr: decision.replyAr,
                outbound: saved.outboundWhatsApp || {
                  status: "sent" as const,
                  at: now,
                },
                task: saved,
              };
            })()
          : await sendAgentWhatsAppConfirmation({
              to: senderDigits,
              task,
            });
        return NextResponse.json({
          ok: true,
          source: parsed.source,
          approvalAction: decision.action,
          approval: decision.item ?? null,
          task: taskWithOutbound,
          confirmationAr: replyAr || decision.replyAr,
          whatsappReply: replyAr || decision.replyAr,
          outboundWhatsApp: outbound,
          campaign: null,
          schoolReport: null,
        });
      }
    }

    // Voice note while items await approval → treat as revision notes (stay AWAITING_APPROVAL).
    if (
      parsed.isWebhookStyle &&
      senderDigits &&
      isAuthorizedInstructorPhone(senderDigits) &&
      (mediaId || mediaUrl || bytes) &&
      !transcript
    ) {
      const awaiting = await listAwaitingApprovals(5);
      if (awaiting[0] && transcript) {
        /* handled below after whisper */
      }
    }

    // Instructor text / voice note over the webhook → محمد agent turn in the background:
    // voice → STT; maths → upgraded solver (+ PDF); mock exam → PDF; anything else → intent pipeline.
    const agentKind: "text" | "audio" | null =
      transcript && !mediaId && !mediaUrl && !bytes
        ? "text"
        : !bytes && (mediaId || mediaUrl) && (parsed.mediaKind === "audio" || !parsed.mediaKind)
          ? "audio"
          : null;
    if (parsed.isWebhookStyle && senderDigits && isAuthorizedInstructorPhone(senderDigits) && agentKind) {
      const from = senderDigits;
      const isPrivileged = privileged;
      const dispatched = await dispatchAgentTurn(
        {
          from,
          kind: agentKind,
          text: agentKind === "text" ? transcript : undefined,
          mediaId,
          mediaUrl,
          mimeType,
          filename,
          messageId: parsed.messageId,
        },
        ({ text, fromVoice }) => pipelineAndConfirm({ text, fromVoice, senderDigits: from, privileged: isPrivileged }),
        true,
      );
      return NextResponse.json({
        ok: true,
        source: parsed.source,
        accepted: agentKind === "audio" ? "voice_note" : "text",
        duplicate: dispatched.mode === "background" ? Boolean(dispatched.duplicate) : false,
      });
    }

    // "امتحان تجريبي" / "mock exam" text → generated mock exam PDF sent back as a document.
    const mockExam = !mediaId && !mediaUrl && !bytes ? parseMockExamRequest(transcript) : { matched: false };
    if (mockExam.matched) {
      const to = senderDigits && isAuthorizedInstructorPhone(senderDigits) ? senderDigits : instructorWhatsAppNumber();
      const dispatched = await dispatchMockExam(
        { to, track: mockExam.track, messageId: parsed.messageId },
        parsed.isWebhookStyle,
      );
      if (dispatched.mode === "background") {
        return NextResponse.json({ ok: true, source: parsed.source, accepted: "mock_exam_pdf", duplicate: Boolean(dispatched.duplicate) });
      }
      return NextResponse.json({
        ok: dispatched.result.ok,
        source: parsed.source,
        mockExam: true,
        task: dispatched.result.reply?.task ?? null,
        whatsappReply: dispatched.result.reply?.task.automatedReplyText ?? null,
        outboundWhatsApp: dispatched.result.reply?.outbound ?? null,
        attachment: dispatched.result.reply?.attachment ?? null,
        error: dispatched.result.error ?? null,
      });
    }

    const hasExecutable = Boolean(bytes || mediaUrl || mediaId || transcript || demo);

    // Authorized instructor inbound with no text/audio — never silent-drop.
    if (!hasExecutable && parsed.isWebhookStyle && senderDigits && isAuthorizedInstructorPhone(senderDigits)) {
      const now = new Date().toISOString();
      const unsupportedType = parsed.messageType || "unknown";
      const failTask: import("@/lib/agent/types").WhatsAppVoiceTask = {
        id: createId("wavtask"),
        audioLog: {
          receivedAt: now,
          senderPhone: senderDigits,
          mimeType: parsed.mimeType,
          mediaUrl: parsed.mediaUrl,
        },
        whisperTranscript: "",
        transcriptSource: "demo",
        transcriptWarning: `unsupported_inbound_type:${unsupportedType}`,
        intent: {
          kind: "general_task",
          confidence: 0,
          parameters: { note: "unsupported_inbound", messageType: unsupportedType },
          source: "demo",
        },
        status: "failed",
        automatedReplyText:
          `تم استلام رسالتكم على واتساب، لكن نوع الرسالة (${unsupportedType}) غير مدعوم حالياً.\n` +
          `يرجى إرسال نص، مذكرة صوتية، صورة، أو ملف PDF. — الأستاذ منذر حداره / MathMentor`,
        relatedIds: [],
        createdAt: now,
        updatedAt: now,
      };
      // WhatsApp FIRST, then persist via attachOutbound inside sender.
      const { replyAr, outbound, task: taskWithOutbound } = await sendAgentWhatsAppConfirmation({
        to: senderDigits,
        task: failTask,
      });
      return NextResponse.json({
        ok: false,
        source: parsed.source,
        unsupported: true,
        messageType: unsupportedType,
        task: taskWithOutbound,
        confirmationAr: replyAr,
        whatsappReply: replyAr,
        outboundWhatsApp: outbound,
        campaign: null,
        schoolReport: null,
      });
    }

    if (!hasExecutable) {
      if (parsed.isWebhookStyle) {
        // Status / empty without sender — ACK only
        return NextResponse.json({ ok: true, ignored: "no_executable_content" });
      }
      demo = true;
      transcript =
        transcript ||
        "أنشئ فيديو تسويقي لترمينال علوم عامة عن قلق الامتحان وأخطاء الباريم في المشتقات والمقاربات";
    }

    // Build + route intent WITHOUT persisting — WhatsApp confirmation first, Agent Hub after.
    const { task, confirmationAr, campaign, schoolReport, stagedApproval } = await runWhatsAppVoicePipeline({
      bytes,
      filename,
      mimeType,
      mediaUrl,
      mediaId,
      transcript,
      demo,
      senderPhone: senderDigits,
      persist: false,
    });

    // Voice edits while a draft awaits approval → stay AWAITING_APPROVAL with revision notes.
    if (
      privileged &&
      senderDigits &&
      isAuthorizedInstructorPhone(senderDigits) &&
      task.whisperTranscript?.trim() &&
      !stagedApproval
    ) {
      const awaiting = await listAwaitingApprovals(3);
      if (awaiting[0] && (task.intent.kind === "general_task" || task.transcriptSource === "whisper")) {
        const looksLikeEdit =
          /عدّل|عدل|غيّر|غير|edit|revise|change/i.test(task.whisperTranscript) ||
          Boolean(mediaId || mediaUrl || bytes);
        if (looksLikeEdit) {
          await appendRevisionNote(awaiting[0].id, task.whisperTranscript.slice(0, 400));
        }
      }
    }

    const health = task.intent.kind === "platform_health" ? await latestHealth() : null;

    const replyTo =
      senderDigits && isAuthorizedInstructorPhone(senderDigits)
        ? senderDigits
        : instructorWhatsAppNumber();

    // Order: outbound WhatsApp → then persist task (attachOutbound / saveVoiceTask).
    const { replyAr, outbound, task: taskWithOutbound } = await sendAgentWhatsAppConfirmation({
      to: replyTo,
      task,
      campaign,
      schoolReport,
      health,
    });

    return NextResponse.json({
      ok: true,
      source: parsed.source,
      task: taskWithOutbound,
      confirmationAr: replyAr || confirmationAr,
      whatsappReply: replyAr || confirmationAr,
      outboundWhatsApp: outbound,
      stagedApproval: stagedApproval ?? null,
      campaign: campaign ?? null,
      schoolReport: schoolReport
        ? {
            id: schoolReport.id,
            schoolName: schoolReport.schoolName,
            completionRate: schoolReport.completionRate,
            textSummary: schoolReport.pdf.textSummary,
            whishWalletPhone: schoolReport.whishWalletPhone,
            whishWalletNameAr: schoolReport.whishWalletNameAr,
          }
        : null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "whatsapp-voice failed";
    const errorAr =
      "تعذّر معالجة الرسالة الواردة من واتساب. يرجى إعادة إرسال نص أو مذكرة صوتية. — الأستاذ منذر حداره";

    // Never silent-drop authorized instructor webhooks on unexpected errors.
    if (isWebhook && senderDigits && isAuthorizedInstructorPhone(senderDigits)) {
      try {
        const now = new Date().toISOString();
        const failTask: import("@/lib/agent/types").WhatsAppVoiceTask = {
          id: createId("wavtask"),
          audioLog: { receivedAt: now, senderPhone: senderDigits },
          whisperTranscript: "",
          transcriptSource: "demo",
          transcriptWarning: errorMessage,
          intent: {
            kind: "general_task",
            confidence: 0,
            parameters: { note: "webhook_handler_error" },
            source: "demo",
          },
          status: "failed",
          automatedReplyText: `${errorAr}\nالتفاصيل: ${errorMessage.slice(0, 180)}`,
          relatedIds: [],
          createdAt: now,
          updatedAt: now,
        };
        const { replyAr, outbound, task } = await sendAgentWhatsAppConfirmation({
          to: senderDigits,
          task: failTask,
        });
        return NextResponse.json(
          {
            ok: false,
            source: parsedSource,
            error: errorMessage,
            errorAr,
            task,
            whatsappReply: replyAr,
            outboundWhatsApp: outbound,
          },
          { status: 500 },
        );
      } catch {
        // fall through
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        errorAr: "تعذّر معالجة الصوت.",
      },
      { status: 500 },
    );
  }
}
