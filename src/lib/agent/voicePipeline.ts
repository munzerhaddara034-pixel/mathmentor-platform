/**
 * WhatsApp voice → Whisper → intent → best-effort execute → Arabic confirmation.
 */

import { createId } from "@/lib/ids";
import { isPracticeDemoDictation, transcribeAudioOrDemo } from "@/lib/voiceMath/whisper";
import {
  AGENT_STT_FAILED_NOTICE_AR,
} from "@/lib/voiceMath/whisperNotices";
import { INSTRUCTOR_AR } from "@/lib/pedagogy/lebanese";
import { parseVoiceIntent } from "./intent";
import { createMarketingCampaign } from "./marketing";
import { generateParentDigest, generateSchoolReport } from "./reports";
import { collectPlatformHealth } from "./health";
import { fetchMetaMediaById, fetchWhatsAppMediaBytes } from "@/lib/whatsapp/adapter";
import {
  createStagedApproval,
  stageMarketingCampaign,
  stageSchoolReport,
} from "./approvalWorkflow";
import { saveVoiceTask } from "./store";
import {
  CODE_EVOLUTION_CONFIRM_AR,
  SCHOOL_OUTREACH_CONFIRM_AR,
  extractCodeChangeDraft,
  extractSchoolLead,
  generateSchoolPitch,
} from "./schoolPitch";
import {
  isVagueAwaitReply,
  trySolveGeneralMathTask,
  vagueAwaitReplyAr,
} from "./generalTaskMath";
import {
  createAppointmentFromIntent,
  createReminderFromIntent,
  formatAppointmentConfirmAr,
  formatDailyBriefingAr,
  formatReminderConfirmAr,
  SECRETARY_EXECUTED_AR,
  SECRETARY_HANDOFF_AR,
  SECRETARY_INTRO_AR,
} from "./secretary";
import type {
  ActionReminder,
  ApprovalItem,
  MarketingCampaign,
  PlatformHealthSnapshot,
  ScheduleAppointment,
  SchoolReport,
  WhatsAppVoiceTask,
} from "./types";

export type VoicePipelineResult = {
  task: WhatsAppVoiceTask;
  confirmationAr: string;
  campaign?: MarketingCampaign;
  schoolReport?: SchoolReport;
  stagedApproval?: ApprovalItem;
  appointment?: ScheduleAppointment;
  reminder?: ActionReminder;
};

function statusOutcomeAr(status: WhatsAppVoiceTask["status"]): string {
  if (status === "completed") return "أُنجزت ✅";
  if (status === "demo") return "أُنجزت في وضع تجريبي (demo) ✅";
  if (status === "queued") return "أُدرجت في قائمة الانتظار ⏳";
  if (status === "processing") return "قيد المعالجة…";
  if (status === "failed") return "تعذّر الإكمال — راجع Agent Hub";
  return `الحالة: ${status}`;
}

function arabicConfirmation(
  task: WhatsAppVoiceTask,
  extras?: {
    appointment?: ScheduleAppointment;
    reminder?: ActionReminder;
    briefingAr?: string;
    health?: PlatformHealthSnapshot;
    campaign?: MarketingCampaign;
    schoolReport?: SchoolReport;
  },
): string {
  const kind = task.intent.kind;
  if (kind === "schedule_appointment" && extras?.appointment) {
    return formatAppointmentConfirmAr(extras.appointment);
  }
  if (kind === "add_reminder" && extras?.reminder) {
    return formatReminderConfirmAr(extras.reminder);
  }
  if (kind === "daily_briefing" && extras?.briefingAr) {
    return extras.briefingAr;
  }

  const header = `🤝 ${SECRETARY_INTRO_AR}`;
  const outcome = statusOutcomeAr(task.status);
  const ids = task.relatedIds.join(", ") || "—";

  // Lead with what محمد executed / queued — never receipt-only «تم استلام».
  if (kind === "generate_video") {
    const camp = extras?.campaign;
    const audience =
      camp?.audience ||
      (typeof task.intent.parameters.audience === "string"
        ? String(task.intent.parameters.audience)
        : "general");
    const hook = camp?.scripts.hooks?.[0] || camp?.scripts.ar?.slice(0, 80) || "—";
    return [
      header,
      `${SECRETARY_EXECUTED_AR}: مسودّة حملة فيديو تسويقي — ${outcome}`,
      `${SECRETARY_HANDOFF_AR}.`,
      `• الجمهور: ${audience}`,
      `• الخطاف: ${hook}`,
      `• المعرّفات: ${ids}`,
      `بانتظار موافقتكم قبل النشر — ردّوا موافق / اعتمد / انشر.`,
    ].join("\n");
  }
  if (kind === "school_report") {
    const report = extras?.schoolReport;
    const summary =
      report?.pdf?.textSummary?.slice(0, 220) ||
      report?.schoolName ||
      "تقرير مدرسي B2B";
    return [
      header,
      `${SECRETARY_EXECUTED_AR}: جهّز ملخّص تقرير مدرسي (PDF) — ${outcome}`,
      `• الملخّص: ${summary}`,
      `• المعرّفات: ${ids}`,
      `بانتظار موافقتكم قبل الإرسال.`,
    ].join("\n");
  }
  if (kind === "platform_health") {
    const health = extras?.health;
    const api = health?.apiStatus || "demo";
    const avg = health?.avgLatencyMs != null ? `${health.avgLatencyMs}ms` : "—";
    const errs =
      health?.recentErrors
        ?.filter((e) => e.statusCode >= 500)
        .slice(0, 3)
        .map((e) => `${e.endpoint} ${e.statusCode}`)
        .join(" · ") || "لا عيّنات 5xx";
    const notices = health?.notices?.slice(0, 2).join(" · ") || "—";
    return [
      header,
      `${SECRETARY_EXECUTED_AR}: فحص صحة المنصّة — ${outcome}`,
      `• API: ${api}`,
      `• متوسط التأخير: ${avg}`,
      `• 502/503: ${errs}`,
      `• ملاحظات: ${notices}`,
      `• المعرّفات: ${ids}`,
    ].join("\n");
  }
  if (kind === "broadcast_message") {
    return [
      header,
      `${SECRETARY_EXECUTED_AR}: جهّز رسالة بث — ${outcome}`,
      `لم يُرسل للعامة تلقائياً — بانتظار موافقة الطاقم.`,
      `النص: ${task.whisperTranscript.slice(0, 200) || "—"}`,
    ].join("\n");
  }
  if (kind === "code_evolution_request") {
    return [
      header,
      CODE_EVOLUTION_CONFIRM_AR,
      `• المعرّفات: ${ids}`,
      `لا يُنشأ Commit قبل اعتمادكم صراحةً.`,
    ].join("\n");
  }
  if (kind === "school_outreach_request") {
    return [
      header,
      SCHOOL_OUTREACH_CONFIRM_AR,
      `• المعرّفات: ${ids}`,
      `لا يُرسل واتساب للمدرسة قبل اعتمادكم.`,
    ].join("\n");
  }
  if (kind === "schedule_appointment") {
    return [
      header,
      `${SECRETARY_EXECUTED_AR}: محاولة تسجيل موعد — ${outcome}`,
      `راجع جدول سكرتير محمد في Agent Hub.`,
    ].join("\n");
  }
  if (kind === "add_reminder") {
    return [
      header,
      `${SECRETARY_EXECUTED_AR}: محاولة إضافة تذكير — ${outcome}`,
      `راجع مهام محمد في Agent Hub.`,
    ].join("\n");
  }
  if (kind === "daily_briefing") {
    return [
      header,
      `${SECRETARY_EXECUTED_AR}: موجز يومي — ${outcome}`,
      `راجع جدول المواعيد والمهام في Agent Hub.`,
    ].join("\n");
  }

  // general_task: state queued vs done clearly (math-like may only be queued).
  const note =
    typeof task.intent.parameters.note === "string"
      ? String(task.intent.parameters.note).slice(0, 200)
      : task.whisperTranscript.slice(0, 200);
  const queuedHint =
    task.status === "queued"
      ? "أُدرجت في قائمة الانتظار (لم يُنفَّذ عمل إضافي بعد) ⏳"
      : outcome;
  return [
    header,
    `${SECRETARY_EXECUTED_AR}: مهمة عامة — ${queuedHint}`,
    `• النص: ${note || "—"}`,
    `• المعرّفات: ${ids}`,
  ].join("\n");
}

async function maybeSaveVoiceTask(
  task: WhatsAppVoiceTask,
  persist: boolean,
): Promise<WhatsAppVoiceTask> {
  if (!persist) return task;
  return saveVoiceTask(task);
}

export async function runWhatsAppVoicePipeline(input: {
  bytes?: Buffer;
  filename?: string;
  mimeType?: string;
  mediaUrl?: string;
  mediaId?: string;
  transcript?: string;
  demo?: boolean;
  senderPhone?: string;
  /**
   * When false, build the task in-memory only so the caller can WhatsApp-reply
   * FIRST, then persist to Agent Hub (never reverse that order for Meta inbound).
   * Default true for backward-compatible hub/demo callers.
   */
  persist?: boolean;
}): Promise<VoicePipelineResult> {
  const persist = input.persist !== false;
  const now = new Date().toISOString();
  let bytes = input.bytes;
  let mimeType = input.mimeType;

  let mediaFetchError: string | undefined;

  try {
    if (!bytes && input.mediaId) {
      const fetched = await fetchMetaMediaById(input.mediaId);
      if (fetched.ok) {
        bytes = fetched.bytes;
        mimeType = mimeType || fetched.mimeType;
      } else {
        mediaFetchError = fetched.error;
      }
    }
    if (!bytes && input.mediaUrl) {
      const fetched = await fetchWhatsAppMediaBytes(input.mediaUrl);
      if (fetched) {
        bytes = fetched.bytes;
        mimeType = mimeType || fetched.mimeType;
      } else if (!mediaFetchError) {
        mediaFetchError = `تعذّر تنزيل الوسائط من الرابط (${input.mediaUrl.slice(0, 80)})`;
      }
    }

    // Meta/audio mediaId present but download failed and no alternate transcript → never silent-drop into demo.
    if (input.mediaId && !bytes && !input.transcript?.trim() && !input.demo) {
      const failReason =
        mediaFetchError ||
        "تعذّر تنزيل المقطع الصوتي من Meta (mediaId) — راجع رمز الوصول أو صلاحية الوسائط.";
      const fail: WhatsAppVoiceTask = {
        id: createId("wavtask"),
        audioLog: {
          filename: input.filename,
          mimeType: input.mimeType,
          mediaUrl: input.mediaUrl,
          bytesLength: undefined,
          receivedAt: now,
          senderPhone: input.senderPhone,
        },
        whisperTranscript: "",
        transcriptSource: "demo",
        transcriptWarning: failReason,
        intent: {
          kind: "general_task",
          confidence: 0,
          parameters: {
            note: "meta_media_fetch_failed",
            mediaId: input.mediaId,
          },
          source: "demo",
        },
        status: "failed",
        automatedReplyText:
          `تعذّر تنزيل المذكرة الصوتية من واتساب (Meta mediaId).
السبب: ${failReason}
` +
          `يرجى إعادة إرسال المذكرة أو استخدام محاكي Agent Hub. — ${INSTRUCTOR_AR}`,
        relatedIds: [],
        createdAt: now,
        updatedAt: now,
      };
      const task = await maybeSaveVoiceTask(fail, persist);
      return { task, confirmationAr: task.automatedReplyText };
    }

    const intentionalDemo = Boolean(input.demo) || (!bytes && !input.transcript && !input.mediaId && !input.mediaUrl);
    const transcript = await transcribeAudioOrDemo({
      bytes,
      filename: input.filename,
      mimeType,
      language: "ar",
      transcript: input.transcript,
      demo: intentionalDemo,
      // WhatsApp / Meta inbound must never invent the studio practice dictation.
      allowPracticeDictation: intentionalDemo,
    });

    // Real audio arrived but STT failed (or slipped a practice dictation) → ask to resend/type.
    // Never answer as if the instructor asked to study f(x)=x^2-5x+6.
    const hadRealAudio = Boolean(bytes || input.mediaId || input.mediaUrl);
    const sttUnusable =
      hadRealAudio &&
      !intentionalDemo &&
      (!transcript.text.trim() ||
        (transcript.source === "demo" && isPracticeDemoDictation(transcript.text)));
    if (sttUnusable) {
      const reason =
        transcript.warningAr ||
        transcript.warning ||
        AGENT_STT_FAILED_NOTICE_AR;
      const fail: WhatsAppVoiceTask = {
        id: createId("wavtask"),
        audioLog: {
          filename: input.filename,
          mimeType,
          mediaUrl: input.mediaUrl,
          bytesLength: bytes?.length,
          receivedAt: now,
          senderPhone: input.senderPhone,
        },
        whisperTranscript: "",
        transcriptSource: "demo",
        transcriptWarning: reason,
        intent: {
          kind: "general_task",
          confidence: 0,
          parameters: { note: "stt_failed_no_fake_dictation" },
          source: "demo",
        },
        status: "failed",
        automatedReplyText: [
          `🤝 ${SECRETARY_INTRO_AR}`,
          `استلمنا مذكرتكم الصوتية، لكن تعذّر تفريغ الصوت الآن (التعرّف على الكلام غير متاح).`,
          `لم نُنفّذ أي مهمة تخمينية ولن نرد بحل رياضي تجريبي.`,
          `يرجى إعادة الإرسال كنص واضح (أو مذكرة جديدة) بما تريدون تنفيذه.`,
          `— ${INSTRUCTOR_AR}`,
        ].join("\n"),
        relatedIds: [],
        createdAt: now,
        updatedAt: now,
      };
      const task = await maybeSaveVoiceTask(fail, persist);
      return { task, confirmationAr: task.automatedReplyText };
    }

    let intent = await parseVoiceIntent(transcript.text);
    let generalMathReply: string | undefined;
    let generalMathWaShort: string | undefined;
    const relatedIds: string[] = [];
    let status: WhatsAppVoiceTask["status"] = "processing";
    let createdCampaign: MarketingCampaign | undefined;
    let createdSchoolReport: SchoolReport | undefined;
    let stagedApproval: ApprovalItem | undefined;
    let createdAppointment: ScheduleAppointment | undefined;
    let createdReminder: ActionReminder | undefined;
    let briefingAr: string | undefined;
    let createdHealth: PlatformHealthSnapshot | undefined;
    const secretarySource = input.senderPhone ? "whatsapp" as const : "hub" as const;

    try {
      if (intent.kind === "schedule_appointment") {
        createdAppointment = await createAppointmentFromIntent({
          intent,
          transcript: transcript.text,
          source: input.bytes || input.mediaId ? "voice" : secretarySource,
          // Always persist secretary records; voice-task persist stays WA-first separately.
          persist: true,
        });
        relatedIds.push(createdAppointment.id);
        status = "completed";
      } else if (intent.kind === "add_reminder") {
        createdReminder = await createReminderFromIntent({
          intent,
          transcript: transcript.text,
          source: input.bytes || input.mediaId ? "voice" : secretarySource,
          persist: true,
        });
        relatedIds.push(createdReminder.id);
        status = "completed";
      } else if (intent.kind === "daily_briefing") {
        briefingAr = await formatDailyBriefingAr();
        status = "completed";
      } else if (intent.kind === "generate_video") {
        const audienceRaw = intent.parameters.audience;
        const audience =
          typeof audienceRaw === "string" && audienceRaw.trim()
            ? (audienceRaw as import("./types").AgentAudience)
            : "general";
        const { campaign } = await createMarketingCampaign({
          audience,
          language: "ar",
        });
        createdCampaign = campaign;
        relatedIds.push(campaign.id);
        if (campaign.heygenJobId) relatedIds.push(campaign.heygenJobId);
        // Stage for instructor approval — never auto-post social.
        try {
          const staged = await stageMarketingCampaign(campaign);
          relatedIds.push(staged.item.id);
          stagedApproval = staged.item;
        } catch {
          /* keep campaign even if staging WA fails */
        }
        status = campaign.demo ? "demo" : campaign.videoStatus === "failed" ? "failed" : "queued";
      } else if (intent.kind === "school_report") {
        const schoolName =
          typeof intent.parameters.schoolName === "string" ? intent.parameters.schoolName : undefined;
        const report = await generateSchoolReport({ schoolName });
        createdSchoolReport = report;
        relatedIds.push(report.id);
        try {
          const staged = await stageSchoolReport(report);
          relatedIds.push(staged.item.id);
          stagedApproval = staged.item;
        } catch {
          /* keep report */
        }
        // Also queue a sample parent digest for ops visibility
        const digest = await generateParentDigest({});
        relatedIds.push(digest.id);
        status = "queued";
      } else if (intent.kind === "platform_health") {
        createdHealth = await collectPlatformHealth();
        relatedIds.push(createdHealth.id);
        status = "completed";
      } else if (intent.kind === "code_evolution_request") {
        const draft = extractCodeChangeDraft(transcript.text, intent.parameters);
        try {
          const staged = await createStagedApproval({
            kind: "code_evolution",
            titleAr: `تطوير كود · ${draft.filePath}`,
            titleEn: `Code evolution · ${draft.filePath}`,
            previewAr: [
              CODE_EVOLUTION_CONFIRM_AR,
              "",
              draft.summaryAr,
              "",
              "مقتطف المحتوى:",
              draft.newContent.slice(0, 600),
            ].join("\n"),
            previewEn: draft.commitMessage,
            payload: {
              filePath: draft.filePath,
              commitMessage: draft.commitMessage,
              newContent: draft.newContent,
              transcript: transcript.text.slice(0, 1000),
            },
          });
          relatedIds.push(staged.item.id);
          stagedApproval = staged.item;
        } catch {
          /* keep queued confirmation even if staging WA fails */
        }
        status = "queued";
      } else if (intent.kind === "school_outreach_request") {
        const lead = extractSchoolLead(transcript.text, intent.parameters);
        const pitch = generateSchoolPitch(lead);
        try {
          const staged = await createStagedApproval({
            kind: "school_outreach",
            titleAr: `تواصل مدرسي · ${lead.schoolName}`,
            titleEn: `School outreach · ${lead.schoolName}`,
            previewAr: [
              SCHOOL_OUTREACH_CONFIRM_AR,
              "",
              pitch.slice(0, 900),
              "",
              lead.principalPhone
                ? `إلى: ${lead.principalPhone}`
                : "⚠️ لم يُستخرج رقم المدير — أضيفوه قبل الاعتماد.",
            ].join("\n"),
            payload: {
              lead,
              pitch,
              transcript: transcript.text.slice(0, 1000),
            },
          });
          relatedIds.push(staged.item.id);
          stagedApproval = staged.item;
        } catch {
          /* keep draft */
        }
        status = "queued";
      } else if (intent.kind === "broadcast_message") {
        status = "queued";
      } else {
        // general_task: complete solvable math inline; never leave vague/math tickets queued forever.
        const math = trySolveGeneralMathTask(transcript.text);
        if (math.matched) {
          status = "completed";
          intent = {
            ...intent,
            parameters: {
              ...intent.parameters,
              mathKind: math.kind,
              finalAnswerLatex: math.finalAnswerLatex,
              summaryAr: math.summaryAr,
              solutionAr: math.solutionAr,
              waShortAr: math.waShortAr,
            },
          };
          generalMathReply = math.solutionAr;
          generalMathWaShort = math.waShortAr;
        } else if (isVagueAwaitReply(transcript.text)) {
          status = "completed";
          generalMathReply = vagueAwaitReplyAr(transcript.text);
        } else {
          // Confirmation already states the next step — close for Hub clarity.
          status = "completed";
        }
      }
    } catch {
      status = "failed";
    }

    const taskSkeleton: WhatsAppVoiceTask = {
      id: createId("wavtask"),
      audioLog: {
        filename: input.filename,
        mimeType,
        mediaUrl: input.mediaUrl,
        bytesLength: bytes?.length,
        receivedAt: now,
        senderPhone: input.senderPhone,
      },
      whisperTranscript: transcript.text,
      transcriptSource: transcript.source === "whisper" ? "whisper" : transcript.source === "typed" ? "typed" : "demo",
      transcriptWarning: [transcript.warning, mediaFetchError].filter(Boolean).join(" · ") || undefined,
      intent,
      status,
      automatedReplyText: "",
      relatedIds,
      createdAt: now,
      updatedAt: now,
    };

    if (generalMathReply) {
      // Hub card shows the full Lebanese solution; WhatsApp uses parameters.waShortAr when set.
      taskSkeleton.automatedReplyText = generalMathReply;
      if (generalMathWaShort) {
        taskSkeleton.intent = {
          ...taskSkeleton.intent,
          parameters: {
            ...taskSkeleton.intent.parameters,
            solutionAr: generalMathReply,
            waShortAr: generalMathWaShort,
          },
        };
      }
    } else {
      taskSkeleton.automatedReplyText = arabicConfirmation(taskSkeleton, {
        appointment: createdAppointment,
        reminder: createdReminder,
        briefingAr,
        health: createdHealth,
        campaign: createdCampaign,
        schoolReport: createdSchoolReport,
      });
    }
    const task = await maybeSaveVoiceTask(taskSkeleton, persist);
    return {
      task,
      confirmationAr: task.automatedReplyText,
      campaign: createdCampaign,
      schoolReport: createdSchoolReport,
      stagedApproval,
      appointment: createdAppointment,
      reminder: createdReminder,
    };
  } catch (error) {
    const fail: WhatsAppVoiceTask = {
      id: createId("wavtask"),
      audioLog: {
        filename: input.filename,
        mimeType: input.mimeType,
        mediaUrl: input.mediaUrl,
        bytesLength: input.bytes?.length,
        receivedAt: now,
        senderPhone: input.senderPhone,
      },
      whisperTranscript: input.transcript?.trim() || "",
      transcriptSource: "demo",
      transcriptWarning: error instanceof Error ? error.message : "pipeline error",
      intent: {
        kind: "general_task",
        confidence: 0,
        parameters: {},
        source: "demo",
      },
      status: "failed",
      automatedReplyText: `تعذّر معالجة المذكرة الصوتية (${SECRETARY_INTRO_AR}). يرجى إعادة المحاولة أو استخدام محاكي Agent Hub. — ${INSTRUCTOR_AR}`,
      relatedIds: [],
      createdAt: now,
      updatedAt: now,
    };
    fail.automatedReplyText = arabicConfirmation(fail);
    const task = await maybeSaveVoiceTask(fail, persist);
    return { task, confirmationAr: task.automatedReplyText };
  }
}
