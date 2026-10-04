/**
 * Draft-and-Approve workflow for the Self-Evolving Executive Agent.
 * Never go live (social / broadcast / school outreach) without instructor approval.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره
 */

import { createId } from "@/lib/ids";
import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import { instructorWhatsAppNumber, sendWhatsApp } from "@/lib/whatsapp/adapter";
import {
  getApprovalItem,
  listApprovalItems,
  saveApprovalItem,
} from "./store";
import { commitCodeDirectly } from "./githubCommit";
import { AGENT_HUB_CODE_COMMITS_ENABLED, CODE_COMMITS_DISABLED_AR } from "@/lib/security/agentBranches";
import { dispatchSchoolPitch, type SchoolLead } from "./schoolPitch";
import type {
  ApprovalItem,
  ApprovalKind,
  ApprovalState,
  MarketingCampaign,
  SchoolReport,
} from "./types";

const APPROVE_RE =
  /^\s*(موافق|اعتمد|انشر|نعم|موافق\s*انشر|approve|deploy|yes|ok|lgtm)\s*[.!؟]?$/i;

const REJECT_RE =
  /^\s*(ارفض|رفض|لا|لا\s*تنشر|reject|deny|no)\s*[.!؟]?$/i;

export function isApprovalCommand(text: string | undefined | null): boolean {
  if (!text?.trim()) return false;
  return APPROVE_RE.test(text.trim());
}

export function isRejectCommand(text: string | undefined | null): boolean {
  if (!text?.trim()) return false;
  return REJECT_RE.test(text.trim());
}

export function stagingPreviewAr(item: ApprovalItem): string {
  const lines = [
    `📋 مسودّة بانتظار موافقتكم — ${INSTRUCTOR_AR}`,
    `المعرّف: ${item.id}`,
    `النوع: ${item.kind}`,
    `العنوان: ${item.titleAr}`,
    "",
    item.previewAr.slice(0, 900),
    "",
    "للنشر المباشر ردّوا: موافق  أو  اعتمد  أو  انشر",
    "للرفض: ارفض",
    "لتعديل عبر مذكرة صوتية: أرسلوا التعديل صوتياً وسنُبقي الحالة AWAITING_APPROVAL.",
    `${INSTRUCTOR_EN} · MathMentor`,
  ];
  return lines.join("\n");
}

export function deployedNotifyAr(item: ApprovalItem): string {
  return [
    `✅ تم الاعتماد والنشر: ${item.titleAr}`,
    `المعرّف: ${item.id}`,
    `الحالة: DEPLOYED`,
    `${INSTRUCTOR_AR} / MathMentor`,
  ].join("\n");
}

export async function createStagedApproval(input: {
  kind: ApprovalKind;
  titleAr: string;
  titleEn?: string;
  previewAr: string;
  previewEn?: string;
  relatedIds?: string[];
  payload?: Record<string, unknown>;
  notifyWhatsApp?: boolean;
}): Promise<{ item: ApprovalItem; outboundStatus?: string; outboundError?: string }> {
  const now = new Date().toISOString();
  const item: ApprovalItem = {
    id: createId("appr"),
    kind: input.kind,
    state: "AWAITING_APPROVAL",
    titleAr: input.titleAr,
    titleEn: input.titleEn,
    previewAr: input.previewAr,
    previewEn: input.previewEn,
    relatedIds: input.relatedIds ?? [],
    payload: input.payload ?? {},
    revisionNotes: [],
    createdAt: now,
    updatedAt: now,
  };

  let outboundStatus: string | undefined;
  let outboundError: string | undefined;

  if (input.notifyWhatsApp !== false) {
    try {
      const body = stagingPreviewAr(item);
      const msg = await sendWhatsApp({
        to: instructorWhatsAppNumber(),
        kind: "agent_ops",
        relatedId: item.id,
        body,
      });
      outboundStatus = msg.status;
      outboundError = msg.error;
      item.stagingWhatsApp = {
        status: msg.status,
        provider: msg.provider,
        to: msg.to,
        error: msg.error,
        messageId: msg.id,
        at: now,
      };
    } catch (error) {
      // Never crash staging if WA fails — keep AWAITING_APPROVAL.
      outboundStatus = "failed";
      outboundError = error instanceof Error ? error.message : "whatsapp staging failed";
      item.stagingWhatsApp = {
        status: "failed",
        to: instructorWhatsAppNumber(),
        error: outboundError,
        at: now,
      };
    }
  }

  const saved = await saveApprovalItem(item);
  return { item: saved, outboundStatus, outboundError };
}

export async function stageMarketingCampaign(
  campaign: MarketingCampaign,
): Promise<{ item: ApprovalItem; outboundStatus?: string }> {
  const previewAr = [
    `حملة تسويق: ${campaign.title}`,
    `الجمهور: ${campaign.audience}`,
    `حالة الفيديو: ${campaign.videoStatus}${campaign.demo ? " (demo)" : ""}`,
    "",
    "نص عربي (مقتطف):",
    campaign.scripts.ar.slice(0, 400),
    "",
    "Social: draft فقط — لن يُنشر للعامة قبل موافقتكم.",
  ].join("\n");

  return createStagedApproval({
    kind: "marketing_video",
    titleAr: `فيديو تسويقي · ${campaign.audience}`,
    titleEn: campaign.title,
    previewAr,
    relatedIds: [campaign.id, campaign.heygenJobId, campaign.heygenVideoId].filter(
      (id): id is string => Boolean(id),
    ),
    payload: {
      campaignId: campaign.id,
      audience: campaign.audience,
      autoPostApproved: false,
    },
  });
}

export async function stageSchoolReport(
  report: SchoolReport,
): Promise<{ item: ApprovalItem; outboundStatus?: string }> {
  const previewAr = [
    `تقرير مدرسي B2B: ${report.schoolName}`,
    `الفترة: ${report.periodLabel}`,
    `نسبة الإنجاز: ${Math.round(report.completionRate * 100)}%`,
    "",
    report.pdf.textSummary.slice(0, 500),
    "",
    `محفظة Whish للدفع (بدون تغيير): ${report.whishWalletPhone} · ${report.whishWalletNameAr}`,
  ].join("\n");

  return createStagedApproval({
    kind: "school_report",
    titleAr: `تقرير · ${report.schoolName}`,
    previewAr,
    relatedIds: [report.id],
    payload: { reportId: report.id, schoolName: report.schoolName },
  });
}

export async function stageWeeklyRecommendation(input: {
  titleAr: string;
  previewAr: string;
  payload?: Record<string, unknown>;
}): Promise<{ item: ApprovalItem }> {
  return createStagedApproval({
    kind: "weekly_recommendation",
    titleAr: input.titleAr,
    previewAr: input.previewAr,
    payload: input.payload ?? {},
  });
}

async function transition(
  item: ApprovalItem,
  next: ApprovalState,
  patch?: Partial<ApprovalItem>,
): Promise<ApprovalItem> {
  const updated: ApprovalItem = {
    ...item,
    ...patch,
    state: next,
    updatedAt: new Date().toISOString(),
    ...(next === "APPROVED" || next === "DEPLOYED"
      ? { approvedAt: patch?.approvedAt || new Date().toISOString() }
      : {}),
    ...(next === "DEPLOYED" ? { deployedAt: new Date().toISOString() } : {}),
    ...(next === "REJECTED" ? { rejectedAt: new Date().toISOString() } : {}),
  };
  return saveApprovalItem(updated);
}

/** Promote AWAITING_APPROVAL → APPROVED → DEPLOYED (one-shot for instructor WA). */

async function runApprovalSideEffects(
  item: ApprovalItem,
): Promise<{ noticeAr?: string }> {
  if (item.kind === "code_evolution") {
    const filePath = String(item.payload.filePath || "").trim();
    const commitMessage = String(item.payload.commitMessage || item.titleAr).trim();
    const newContent = String(item.payload.newContent ?? "");
    if (!filePath) {
      return { noticeAr: "مسودّة الكود ناقصة (filePath) — لم يُنشأ Commit." };
    }
    const res = await commitCodeDirectly({ filePath, commitMessage, newContent });
    if (res.disabled) return { noticeAr: CODE_COMMITS_DISABLED_AR };
    if (!res.ok) {
      return { noticeAr: `فشل Commit: ${res.error || "unknown"}` };
    }
    return {
      noticeAr: res.commitUrl
        ? `تم إنشاء Commit: ${res.commitUrl}`
        : "تم إنشاء Commit على GitHub.",
    };
  }
  if (item.kind === "school_outreach") {
    const leadRaw = item.payload.lead;
    if (!leadRaw || typeof leadRaw !== "object") {
      return { noticeAr: "مسودّة التواصل المدرسي بلا lead — لم يُرسل واتساب." };
    }
    const lead = leadRaw as SchoolLead;
    const res = await dispatchSchoolPitch(lead);
    if (!res.ok) {
      return { noticeAr: `فشل إرسال العرض للمدرسة: ${res.error || "unknown"}` };
    }
    return { noticeAr: `تم إرسال العرض المدرسي عبر واتساب (${res.status || "ok"}).` };
  }
  return {};
}

export async function approveAndDeploy(
  id: string,
  opts?: { actor?: string; note?: string },
): Promise<{ ok: true; item: ApprovalItem } | { ok: false; error: string }> {
  const item = await getApprovalItem(id);
  if (!item) return { ok: false, error: "approval not found" };
  if (item.state === "DEPLOYED") return { ok: true, item };
  if (item.state === "REJECTED") return { ok: false, error: "already rejected" };
  if (item.state !== "AWAITING_APPROVAL" && item.state !== "APPROVED" && item.state !== "DRAFTED") {
    return { ok: false, error: `cannot approve from ${item.state}` };
  }
  // Path B: code-evolution proposals stay listable but can't be approved into a commit.
  if (item.kind === "code_evolution" && !AGENT_HUB_CODE_COMMITS_ENABLED) {
    return { ok: false, error: CODE_COMMITS_DISABLED_AR };
  }

  let next = await transition(item, "APPROVED", {
    actor: opts?.actor || "instructor_whatsapp",
    decisionNote: opts?.note,
  });
  // Immediate deploy — never auto without this explicit approve path.
  next = await transition(next, "DEPLOYED");

  const side = await runApprovalSideEffects(next);
  if (side.noticeAr) {
    next = {
      ...next,
      payload: { ...next.payload, deployNoticeAr: side.noticeAr },
      updatedAt: new Date().toISOString(),
    };
    next = await saveApprovalItem(next);
  }

  try {
    const body = side.noticeAr
      ? `${deployedNotifyAr(next)}\n${side.noticeAr}`
      : deployedNotifyAr(next);
    await sendWhatsApp({
      to: instructorWhatsAppNumber(),
      kind: "agent_ops",
      relatedId: next.id,
      body,
    });
  } catch {
    // Keep DEPLOYED even if notify fails.
  }

  return { ok: true, item: next };
}

export async function rejectApproval(
  id: string,
  opts?: { actor?: string; note?: string },
): Promise<{ ok: true; item: ApprovalItem } | { ok: false; error: string }> {
  const item = await getApprovalItem(id);
  if (!item) return { ok: false, error: "approval not found" };
  if (item.state === "DEPLOYED") return { ok: false, error: "already deployed" };
  const next = await transition(item, "REJECTED", {
    actor: opts?.actor || "instructor_whatsapp",
    decisionNote: opts?.note,
  });
  return { ok: true, item: next };
}

export async function appendRevisionNote(
  id: string,
  note: string,
): Promise<ApprovalItem | undefined> {
  const item = await getApprovalItem(id);
  if (!item) return undefined;
  if (item.state === "DEPLOYED" || item.state === "REJECTED") return item;
  const notes = [...(item.revisionNotes || []), { at: new Date().toISOString(), note: note.slice(0, 500) }];
  return transition(item, "AWAITING_APPROVAL", { revisionNotes: notes });
}

/**
 * Handle instructor WhatsApp text as approval/reject for the latest awaiting item.
 * Returns null if text is not an approval command.
 */
export async function handleApprovalInboundText(input: {
  text: string;
  senderPhone?: string;
}): Promise<{
  handled: boolean;
  action?: "approve" | "reject" | "none";
  item?: ApprovalItem;
  replyAr: string;
}> {
  const text = input.text?.trim() || "";
  if (!text) return { handled: false, replyAr: "" };

  if (isApprovalCommand(text)) {
    // "ok"/«موافق» never approves a code-evolution proposal (commits are disabled).
    const awaiting = (await listApprovalItems(40)).filter(
      (i) => i.state === "AWAITING_APPROVAL" && (i.kind !== "code_evolution" || AGENT_HUB_CODE_COMMITS_ENABLED),
    );
    const target = awaiting[0];
    if (!target) {
      return {
        handled: true,
        action: "none",
        replyAr: "لا توجد مسودّات بانتظار الموافقة حالياً.",
      };
    }
    const result = await approveAndDeploy(target.id, { actor: input.senderPhone || "instructor" });
    if (!result.ok) {
      return { handled: true, action: "approve", replyAr: `تعذّر الاعتماد: ${result.error}` };
    }
    return {
      handled: true,
      action: "approve",
      item: result.item,
      replyAr: deployedNotifyAr(result.item),
    };
  }

  if (isRejectCommand(text)) {
    const awaiting = (await listApprovalItems(40)).filter((i) => i.state === "AWAITING_APPROVAL");
    const target = awaiting[0];
    if (!target) {
      return {
        handled: true,
        action: "none",
        replyAr: "لا توجد مسودّات لرفضها حالياً.",
      };
    }
    const result = await rejectApproval(target.id, { actor: input.senderPhone || "instructor", note: text });
    if (!result.ok) {
      return { handled: true, action: "reject", replyAr: `تعذّر الرفض: ${result.error}` };
    }
    return {
      handled: true,
      action: "reject",
      item: result.item,
      replyAr: `تم الرفض: ${result.item.titleAr}\nالحالة: REJECTED`,
    };
  }

  return { handled: false, replyAr: "" };
}

export async function listAwaitingApprovals(limit = 20): Promise<ApprovalItem[]> {
  return (await listApprovalItems(limit * 2))
    .filter((i) => i.state === "AWAITING_APPROVAL" || i.state === "DRAFTED")
    .slice(0, limit);
}
