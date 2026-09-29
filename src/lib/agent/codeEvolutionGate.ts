import { authorizeAgentRequest } from "./auth";

/**
 * Code-evolution commits straight to GitHub, so it only runs for a staff session or a caller
 * holding AGENT_WEBHOOK_SECRET / JOBS_SECRET — never for anonymous chat traffic, and never in
 * the open "demo" mode that authorizeAgentRequest allows when no secret is configured.
 */
export async function canRunCodeEvolution(request: Request): Promise<boolean> {
  const auth = await authorizeAgentRequest(request);
  return auth.ok && auth.mode !== "demo";
}

/** Owner's Arabic trigger words for "change the platform" commands. */
export function looksLikeCodeChange(text: string, extraTriggers: string[] = []): boolean {
  const triggers = ["عدل", "تعديل", "غير", "صفحة", "أضف", "كود", ...extraTriggers];
  return triggers.some((word) => text.includes(word));
}

export const CODE_EVOLUTION_LOCKED_AR =
  "🔒 أوامر تعديل الكود تتطلب جلسة الأستاذ أو سر الوكيل (AGENT_WEBHOOK_SECRET). سُجّل طلبك كرسالة عادية.";
