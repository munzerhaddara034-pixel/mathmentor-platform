import { NextResponse } from "next/server";
import { hamzaReadiness } from "@/lib/hamza/readiness";
import { isSameOriginRequest } from "@/lib/hamza/sameOrigin";
import { cancelHamzaTask, continueHamzaTask } from "@/lib/hamza/tasks/enqueue";
import { taskDeps } from "@/lib/hamza/tasks/deps";
import { publicTask } from "@/lib/hamza/tasks/types";
import { clientIpFrom } from "@/lib/security/rateLimit";
import { canApprove, requireTeamStaff, teamError } from "@/lib/team/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → task + recent steps. POST {action:"cancel"|"continue"} — continue raises the cap to HAMZA_TASK_BUDGET_MAX_USD (approvers). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  const deps = taskDeps();
  const task = await deps.tasks.get(id);
  if (!task) return teamError(404, "Task not found.", "المهمة غير موجودة.");
  const steps = await deps.tasks.listSteps(id, 60);
  return NextResponse.json({ ok: true, task: publicTask(task), steps }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  if (!isSameOriginRequest(request.headers)) return teamError(403, "Cross-site request refused.", "طلب من موقع آخر مرفوض.");
  let action: unknown;
  try {
    action = ((await request.json()) as { action?: unknown }).action;
  } catch {
    return teamError(400, "Invalid JSON.", "طلب غير صالح.");
  }
  if (action !== "cancel" && action !== "continue") return teamError(400, "Unknown action.", "الإجراء غير صالح.");
  if (action === "continue" && !hamzaReadiness().ready) return teamError(503, "Hamza is not configured on this server.", "حمزة غير مُعدّ على هذا الخادم.");
  if (action === "continue" && !canApprove(gate.actor)) return teamError(403, "Not an approver.", "رفع حد الإنفاق يحتاج حساباً مخوّلاً بالموافقة.");
  const { id } = await context.params;
  const actor = { ...gate.actor, ip: clientIpFrom(request.headers) };
  try {
    const deps = taskDeps();
    const task = action === "cancel" ? await cancelHamzaTask(deps, id, actor) : await continueHamzaTask(deps, id, actor);
    if (!task) return teamError(409, "Task cannot do that now.", action === "cancel" ? "لا يمكن إلغاء هذه المهمة الآن." : "لا يمكن متابعة هذه المهمة (ليست متوقفة عند حد المهمة أو بلغت الحد الأعلى).");
    return NextResponse.json({ ok: true, task: publicTask(task) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("team/tasks POST", error);
    return teamError(500, "Task action failed.", "تعذّر تنفيذ الإجراء.");
  }
}
