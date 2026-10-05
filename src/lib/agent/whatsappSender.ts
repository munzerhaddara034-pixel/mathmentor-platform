/**
 * Outbound Arabic WhatsApp confirmations for the autonomous agent.
 * Always uses src/lib/whatsapp/adapter.ts — never a parallel sender.
 */

import { createId } from "@/lib/ids";
import {
  isAuthorizedInstructorPhone,
  instructorWhatsAppNumber,
  sendWhatsApp,
} from "@/lib/whatsapp/adapter";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import type {
  AgentIntentKind,
  MarketingCampaign,
  ParentDigest,
  PlatformHealthSnapshot,
  SchoolReport,
  WhatsAppVoiceTask,
} from "./types";
import { saveVoiceTask } from "./store";
import { SECRETARY_EXECUTED_AR, SECRETARY_HANDOFF_AR, SECRETARY_INTRO_AR } from "./secretary";

export const UNAUTHORIZED_AGENT_WA_AR =
  "عذراً، هذا الرقم مخصص لإدارة منصة Math Mentor فقط.";

export type AgentOutboundStatus = {
  status: "sent" | "logged" | "failed" | "skipped";
  provider?: string;
  to?: string;
  error?: string;
  messageId?: string;
  at: string;
};

function statusLineAr(status: WhatsAppVoiceTask["status"]): string {
  if (status === "completed") return `${SECRETARY_EXECUTED_AR}: تم تنفيذ المهمة بنجاح ✅`;
  if (status === "demo") return `${SECRETARY_EXECUTED_AR}: تم التنفيذ في وضع تجريبي (demo) ✅`;
  if (status === "queued") return `${SECRETARY_EXECUTED_AR}: أُدرجت المهمة في قائمة الانتظار ⏳`;
  if (status === "processing") return `${SECRETARY_EXECUTED_AR}: المهمة قيد المعالجة…`;
  if (status === "failed") return `تعذّر إكمال المهمة — راجع Agent Hub.`;
  return `الحالة: ${status}`;
}

function goalsBlockAr(input: {
  task: WhatsAppVoiceTask;
  campaign?: MarketingCampaign;
  schoolReport?: SchoolReport;
  health?: PlatformHealthSnapshot | null;
}): string {
  const { task, campaign, schoolReport, health } = input;
  const kind = task.intent.kind;
  const lines: string[] = [];

  if (kind === "generate_video") {
    const audience =
      typeof task.intent.parameters.audience === "string"
        ? String(task.intent.parameters.audience)
        : campaign?.audience || "general";
    const hook = campaign?.scripts.hooks?.[0] || campaign?.scripts.ar?.slice(0, 80) || "—";
    const preview =
      campaign?.videoUrl ||
      (campaign?.heygenVideoId ? `HeyGen:${campaign.heygenVideoId}` : "") ||
      (campaign?.id ? `campaign:${campaign.id}` : "—");
    lines.push(`🤝 ${SECRETARY_INTRO_AR}`);
    lines.push(`🎯 ${SECRETARY_HANDOFF_AR}: فيديو تسويقي`);
    lines.push("أهداف الفيديو:");
    lines.push(`• الجمهور: ${audience}`);
    lines.push(`• الخطاف: ${hook}`);
    lines.push(`• معاينة: ${preview}`);
  } else if (kind === "school_report") {
    const bareme =
      schoolReport?.baremeMistakeTrends
        ?.slice(0, 3)
        .map((t) => `${t.topicAr || t.topic} (${t.ratePct}%)`)
        .join(" · ") || "—";
    const summary =
      schoolReport?.pdf?.textSummary?.slice(0, 220) ||
      schoolReport?.schoolName ||
      "تقرير مدرسي";
    lines.push(`🤝 ${SECRETARY_INTRO_AR}`);
    lines.push(`🎯 ${SECRETARY_HANDOFF_AR}: تقرير مدرسي`);
    lines.push("تقرير المدرسة (Barème):");
    lines.push(`• أخطاء شائعة: ${bareme}`);
    lines.push(`• ملخّص: ${summary}`);
  } else if (kind === "platform_health") {
    const api = health?.apiStatus || "demo";
    const errs =
      health?.recentErrors
        ?.filter((e) => e.statusCode >= 500)
        .slice(0, 3)
        .map((e) => `${e.endpoint} ${e.statusCode}`)
        .join(" · ") || "لا عيّنات 5xx";
    lines.push(`🤝 ${SECRETARY_INTRO_AR}`);
    lines.push(`🎯 ${SECRETARY_HANDOFF_AR}: فحص صحة المنصّة`);
    lines.push("صحة المنصّة:");
    lines.push(`• API: ${api}`);
    lines.push(`• 502/503: ${errs}`);
  } else if (kind === "broadcast_message") {
    lines.push(`🤝 ${SECRETARY_INTRO_AR}`);
    lines.push(`🎯 ${SECRETARY_HANDOFF_AR}: بث رسالة — بانتظار موافقة الطاقم (لم يُرسل للعامة).`);
  } else if (kind === "schedule_appointment") {
    const title =
      typeof task.intent.parameters.title === "string"
        ? task.intent.parameters.title
        : typeof task.intent.parameters.subject === "string"
          ? task.intent.parameters.subject
          : "موعد";
    lines.push(`🤝 ${SECRETARY_INTRO_AR}`);
    lines.push(`🎯 ${SECRETARY_EXECUTED_AR}: موعد مسجّل:`);
    lines.push(`• ${String(title).slice(0, 120)}`);
  } else if (kind === "add_reminder") {
    const remTask =
      typeof task.intent.parameters.task === "string"
        ? task.intent.parameters.task
        : task.whisperTranscript.slice(0, 120);
    lines.push(`🤝 ${SECRETARY_INTRO_AR}`);
    lines.push(`🎯 ${SECRETARY_EXECUTED_AR}: تذكير محفوظ:`);
    lines.push(`• ${String(remTask).slice(0, 160)}`);
  } else if (kind === "daily_briefing") {
    lines.push(`🤝 ${SECRETARY_INTRO_AR}`);
    lines.push(`🎯 ${SECRETARY_EXECUTED_AR}: موجز محمد اليومي جاهز — راجع الرسالة أعلاه أو Agent Hub.`);
  } else {
    const note =
      typeof task.intent.parameters.note === "string"
        ? String(task.intent.parameters.note).slice(0, 160)
        : task.whisperTranscript.slice(0, 160);
    lines.push(`🤝 ${SECRETARY_INTRO_AR}`);
    const queued =
      task.status === "queued"
        ? "أُدرجت في قائمة الانتظار (لم يُنفَّذ عمل إضافي بعد)"
        : "مهمة عامة";
    lines.push(`🎯 ${SECRETARY_EXECUTED_AR}: ${queued}`);
    lines.push(`• ${note || "—"}`);
  }

  return lines.join("\n");
}

const SECRETARY_KINDS = new Set([
  "schedule_appointment",
  "add_reminder",
  "daily_briefing",
]);

export function formatAgentWhatsAppReplyAr(input: {
  task: WhatsAppVoiceTask;
  campaign?: MarketingCampaign;
  schoolReport?: SchoolReport;
  health?: PlatformHealthSnapshot | null;
  transcriptExcerpt?: string;
}): string {
  // Short WA math summary wins over the Hub full solution card.
  const waShort = input.task.intent?.parameters?.waShortAr;
  if (typeof waShort === "string" && waShort.trim()) {
    return waShort.trim();
  }

  // Prefer pipeline/secretary/approval Arabic already on the task (محمد-branded where applicable).
  // Do not rewrite approval workflow wording (موافق / اعتمد / ارفض) when present.
  // Dilute legacy receipt-only leads («تم استلام…») without a result body.
  const existing = (
    typeof input.task.automatedReplyText === "string"
      ? input.task.automatedReplyText.trim()
      : ""
  );
  if (existing) {
    const receiptOnly =
      /^(تم استلام توجيهكم|تم استلام المذكرة)/.test(existing) &&
      !/نفّذ محمد|تم تسجيل الموعد|تم إضافة التذكير|الموجز اليومي|مسودّة|فحص صحة|جهّز/.test(
        existing,
      );
    if (!receiptOnly) return existing;
  }

  const excerpt = (
    input.transcriptExcerpt ||
    input.task.whisperTranscript ||
    ""
  )
    .trim()
    .slice(0, 120);
  // Result-first: goals (what was done) → status → short transcript reference (never lead with تم استلام).
  const parts = [
    goalsBlockAr(input),
    statusLineAr(input.task.status),
    excerpt ? `المرجع: ${excerpt}` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

async function attachOutbound(
  task: WhatsAppVoiceTask,
  outbound: AgentOutboundStatus,
  replyAr: string,
): Promise<WhatsAppVoiceTask> {
  const next: WhatsAppVoiceTask = {
    ...task,
    automatedReplyText: replyAr || task.automatedReplyText,
    outboundWhatsApp: outbound,
    updatedAt: new Date().toISOString(),
  };
  try {
    return await saveVoiceTask(next);
  } catch {
    return next;
  }
}

/**
 * Send (or log) the agent confirmation to the instructor WhatsApp.
 * Never throws — failures are recorded on the voice task / outbox.
 */
export async function sendAgentWhatsAppConfirmation(input: {
  to?: string;
  task: WhatsAppVoiceTask;
  campaign?: MarketingCampaign;
  schoolReport?: SchoolReport;
  health?: PlatformHealthSnapshot | null;
  /** When set, Meta gets interactive reply buttons; other providers keep the text body as-is. */
  interactiveButtons?: ReadonlyArray<{ id: string; title: string }>;
  /** Override the formatted reply body (e.g. level-ask text). */
  bodyOverrideAr?: string;
}): Promise<{ replyAr: string; outbound: AgentOutboundStatus; message?: WhatsAppMessage; task: WhatsAppVoiceTask }> {
  const replyAr = input.bodyOverrideAr ?? formatAgentWhatsAppReplyAr(input);
  const toRaw = input.to?.trim() || instructorWhatsAppNumber();
  const at = new Date().toISOString();

  try {
    // Only reply to authorized instructor numbers (or default instructor when hub-triggered).
    if (input.to?.trim() && !isAuthorizedInstructorPhone(input.to)) {
      const outbound: AgentOutboundStatus = {
        status: "skipped",
        to: input.to,
        error: "unauthorized sender — not sending agent pipeline reply",
        at,
      };
      const task = await attachOutbound(input.task, outbound, replyAr);
      return { replyAr, outbound, task };
    }

    const message = await sendWhatsApp({
      to: toRaw,
      kind: "agent_ops",
      relatedId: input.task.id,
      body: replyAr,
      interactiveButtons: input.interactiveButtons,
    });

    const outbound: AgentOutboundStatus = {
      status: message.status,
      provider: message.provider,
      to: message.to,
      error: message.error,
      messageId: message.id,
      at,
    };
    const task = await attachOutbound(input.task, outbound, replyAr);
    return { replyAr, outbound, message, task };
  } catch (error) {
    const outbound: AgentOutboundStatus = {
      status: "failed",
      to: toRaw,
      error: error instanceof Error ? error.message : "outbound failed",
      at,
    };
    const task = await attachOutbound(input.task, outbound, replyAr);
    return { replyAr, outbound, task };
  }
}

export async function sendUnauthorizedAgentReply(to: string): Promise<AgentOutboundStatus> {
  const at = new Date().toISOString();
  try {
    const message = await sendWhatsApp({
      to,
      kind: "agent_ops",
      body: UNAUTHORIZED_AGENT_WA_AR,
    });
    return {
      status: message.status,
      provider: message.provider,
      to: message.to,
      error: message.error,
      messageId: message.id,
      at,
    };
  } catch (error) {
    return {
      status: "failed",
      to,
      error: error instanceof Error ? error.message : "unauthorized reply failed",
      at,
    };
  }
}


/**
 * Hub-triggered completion → synthetic voice task + Arabic WhatsApp to instructor.
 * Used by marketing-video / generate-report / health (explicit notify) / marketing webhook.
 */
export async function notifyInstructorHubCompletion(input: {
  intentKind: AgentIntentKind;
  status?: WhatsAppVoiceTask["status"];
  transcript: string;
  relatedIds?: string[];
  campaign?: MarketingCampaign;
  schoolReport?: SchoolReport;
  parentDigest?: ParentDigest;
  health?: PlatformHealthSnapshot | null;
}): Promise<{ replyAr: string; outbound: AgentOutboundStatus; task: WhatsAppVoiceTask }> {
  const now = new Date().toISOString();
  const status = input.status ?? "completed";
  const relatedIds = [...(input.relatedIds ?? [])];
  if (input.campaign?.id) relatedIds.push(input.campaign.id);
  if (input.schoolReport?.id) relatedIds.push(input.schoolReport.id);
  if (input.parentDigest?.id) relatedIds.push(input.parentDigest.id);
  if (input.health?.id) relatedIds.push(input.health.id);

  const uniqueRelated = [...new Set(relatedIds.filter(Boolean))];

  const task: WhatsAppVoiceTask = {
    id: createId("hubtask"),
    audioLog: {
      receivedAt: now,
      senderPhone: instructorWhatsAppNumber(),
    },
    whisperTranscript: input.transcript,
    transcriptSource: "typed",
    intent: {
      kind: input.intentKind,
      confidence: 1,
      parameters: { source: "agent_hub" },
      source: "demo",
    },
    status,
    automatedReplyText: "",
    relatedIds: uniqueRelated,
    createdAt: now,
    updatedAt: now,
  };

  // For parent digests, fold a short Arabic note into parameters for goalsBlockAr.
  if (input.parentDigest) {
    task.intent.parameters.note = input.parentDigest.whatsapp.bodyAr.slice(0, 160);
  }

  const saved = await saveVoiceTask(task);
  return sendAgentWhatsAppConfirmation({
    to: instructorWhatsAppNumber(),
    task: saved,
    campaign: input.campaign,
    schoolReport: input.schoolReport,
    health: input.health,
  });
}
