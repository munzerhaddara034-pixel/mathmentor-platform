import { NextResponse } from "next/server";
import { createId } from "@/lib/ids";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import { latestHealth } from "@/lib/agent/store";
import { runWhatsAppVoicePipeline } from "@/lib/agent/voicePipeline";
import {
  handleApprovalInboundText,
  appendRevisionNote,
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
  teacherWhatsApp,
} from "@/lib/whatsapp/adapter";

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
  isWebhookStyle: boolean;
};

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
        const textObj = asRecord(m.text);
        const audioObj = asRecord(m.audio) || asRecord(m.voice) || asRecord(m.document);
        const textBody = pickString(textObj?.body, m.body);
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
  return {
    source: "staff",
    senderPhone,
    textBody: transcript,
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
  const mode = url.searchParams.get("hub.mode") || url.searchParams.get("hub_mode");
  const token = url.searchParams.get("hub.verify_token") || url.searchParams.get("hub_verify_token");
  const challenge = url.searchParams.get("hub.challenge") || url.searchParams.get("hub_challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "mathmentor_secret_token";

  if (mode === "subscribe" && token && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({
    ok: true,
    endpoint: "agent-whatsapp-voice",
    brand: "Prof. Munzer Haddara / الأستاذ منذر حداره",
    webhookUrl: "https://mathmentor-platform.onrender.com/api/agent/whatsapp-voice",
    verify: {
      modeParam: "hub.mode=subscribe",
      tokenEnv: "WHATSAPP_VERIFY_TOKEN",
      challengeParam: "hub.challenge",
    },
    allowlist: {
      instructor: instructorWhatsAppNumber(),
      acceptedForms: ["76532421", "076532421", "96176532421", "+96176532421", "0096176532421"],
      note: "Agent Hub voice allowlist only — Whish/payment remains TEACHER_WHATSAPP / WHISH_TRANSFER_PHONE 96170772968",
    },
    whishPaymentPhone: teacherWhatsApp(),
    accepts: [
      "Meta Cloud API webhook (GET verify + POST messages)",
      "UltraMsg-style JSON webhook",
      "Twilio WhatsApp form posts",
      "Staff multipart / JSON from Agent Hub",
    ],
  });
}

export async function POST(request: Request) {
  let senderDigits: string | undefined;
  let parsedSource: InboundParsed["source"] = "unknown";
  let isWebhook = false;

  try {
    const contentType = request.headers.get("content-type") || "";
    let parsed: InboundParsed;

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      const twilio = parseTwilioForm(form);
      // Twilio webhook vs staff multipart: Twilio has From/WaId; staff has file fields
      const hasStaffFile = Boolean(form.get("file") || form.get("audio") || form.get("voice"));
      if (twilio && !hasStaffFile && twilio.isWebhookStyle) {
        parsed = twilio;
      } else {
        parsed = await parseStaffMultipart(form);
        if (twilio?.senderPhone && !parsed.senderPhone) {
          parsed = { ...parsed, senderPhone: twilio.senderPhone };
        }
      }
    } else {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON or multipart body." }, { status: 400 });
      }
      const meta = parseMetaPayload(body);
      const ultra = meta ? null : parseUltraMsgPayload(body);
      if (meta && (meta.senderPhone || meta.mediaId || meta.textBody || meta.source === "meta")) {
        // Empty status callbacks: ACK quickly (no phone / no content)
        if (!meta.senderPhone && !meta.mediaId && !meta.textBody && !meta.mediaUrl) {
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

    let transcript = parsed.textBody;
    let demo = Boolean(parsed.demo);
    let bytes = parsed.bytes;
    const mediaUrl = parsed.mediaUrl;
    const mediaId = parsed.mediaId;
    const filename = parsed.filename;
    const mimeType = parsed.mimeType;

    // Approval listener: موافق / اعتمد / انشر → DEPLOYED (never auto-deploy without this).
    if (
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
          `يرجى إرسال نص أو مذكرة صوتية. — الأستاذ منذر حداره / MathMentor`,
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
