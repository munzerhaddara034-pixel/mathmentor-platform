/** Runtime context blocks appended after the verbatim persona prompts (Beirut time, agenda, protocol). */
import { agentOverview } from "@/lib/agent/store";
import type { TeamProposal } from "./types";

const BEIRUT_TZ = "Asia/Beirut";

export function beirutNowAr(now = new Date()): string {
  const ar = now.toLocaleString("ar-LB", {
    timeZone: BEIRUT_TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIRUT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).format(now);
  return `${ar} (بتوقيت بيروت) — ${iso}`;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar-LB", {
      timeZone: BEIRUT_TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

/** Live platform data for محمد (daily briefing, Agent Hub follow-up). Never throws. */
export async function mohamedDataContext(pendingProposals: TeamProposal[]): Promise<string> {
  const lines: string[] = [
    "## بيانات المنصة الحيّة (للموجز والمتابعة — لا تخترع بيانات غير موجودة هنا)",
    "- أي قسم مكتوب فيه «لا توجد بيانات» تنقله في الموجز حرفياً «لا توجد بيانات»؛ لا تفترض أن خدمة تعمل أو متوقفة بلا فحص مسجّل.",
  ];
  try {
    const overview = await agentOverview();
    const upcoming = overview.appointments
      .filter((a) => a.status === "scheduled" || a.status === "pending")
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime))
      .slice(0, 10);
    lines.push("### المواعيد المسجّلة");
    lines.push(
      upcoming.length
        ? upcoming.map((a) => `- ${fmt(a.dateTime)} — ${a.title}${a.contactPerson ? ` · ${a.contactPerson}` : ""}`).join("\n")
        : "- لا توجد بيانات",
    );
    const open = overview.reminders.filter((r) => r.status === "open").slice(0, 10);
    const nowIso = new Date().toISOString();
    lines.push("### التذكيرات المفتوحة");
    lines.push(
      open.length
        ? open.map((r) => `- ${r.dueDate < nowIso ? "⏰ متأخر: " : ""}${r.task} — ${fmt(r.dueDate)} [${r.priority}]`).join("\n")
        : "- لا توجد بيانات",
    );
    const approvals = overview.approvals.filter((a) => a.state === "AWAITING_APPROVAL" || a.state === "DRAFTED").slice(0, 8);
    lines.push("### Agent Hub — عناصر تنتظر موافقة");
    lines.push(
      approvals.length
        ? approvals.map((a) => `- ${a.titleAr} (${a.kind}، آخر تحديث ${fmt(a.updatedAt)})`).join("\n")
        : "- لا توجد بيانات",
    );
    const tasks = overview.voiceTasks.slice(0, 5);
    lines.push("### Agent Hub — آخر المهام الصوتية");
    lines.push(
      tasks.length
        ? tasks.map((t) => `- ${t.whisperTranscript.slice(0, 90)} (${fmt(t.audioLog.receivedAt)})`).join("\n")
        : "- لا توجد بيانات",
    );
    const health = overview.health;
    lines.push("### صحة المنصة (آخر فحص)");
    lines.push(
      health
        ? `- الحالة: ${health.apiStatus} · متوسط الاستجابة ${health.avgLatencyMs}ms · ${fmt(health.checkedAt)}${
            health.notices.length ? ` · ملاحظات: ${health.notices.slice(0, 3).join(" | ")}` : ""
          }`
        : "- لا توجد بيانات",
    );
  } catch {
    lines.push("- تعذّر قراءة بيانات Agent Hub الآن — اكتب «لا توجد بيانات» للأقسام المعنية.");
  }
  lines.push("### Diff المطوّر بانتظار موافقة منذر (من /admin/team)");
  lines.push(
    pendingProposals.length
      ? pendingProposals.map((p) => `- ${p.commitMessage} → ${p.targetBranch} (${p.files.length} ملف)`).join("\n")
      : "- لا توجد بيانات",
  );
  return lines.join("\n");
}

export const MOHAMED_ACTIONS_PROTOCOL_AR = `## بروتوكول التسجيل الآلي (تقني — مضاف من المنصة)
إذا طُلب منك تسجيل موعد أو تذكير، أضف في آخر ردّك كتلة واحدة بالضبط بهذا الشكل (تُحذف من العرض وتُسجَّل في جدول السكرتير في Agent Hub تلقائياً):
\`\`\`mm-actions
{"appointments":[{"title":"...","dateTime":"2026-10-01T16:00:00+03:00","contactPerson":"...","notes":"..."}],"reminders":[{"task":"...","dueDate":"2026-09-30T16:00:00+03:00","priority":"high"}]}
\`\`\`
- التواريخ بصيغة ISO مع إزاحة بيروت (+03:00 صيفاً). لا تضع الكتلة إذا لم يُطلب تسجيل شيء.
- التسجيل الداخلي مسموح؛ أي إرسال لطرف ثالث يبقى مسودة بانتظار موافقة منذر.`;
