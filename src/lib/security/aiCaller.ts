/**
 * Gate for routes that spend Gemini quota on behalf of the caller (/api/bot, the WhatsApp-voice
 * Gemini proxy). Allowed: a signed-in user with AI access (AI_TIER / BOTH, not expired), staff, or a
 * server-to-server caller presenting AGENT_WEBHOOK_SECRET / JOBS_SECRET (never the open "demo" mode).
 * Logged-out visitors get 401 with a sign-in hint; users without AI access get 403 with an upgrade hint.
 */
import { NextResponse } from "next/server";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { userHasAiAccess } from "@/lib/auth/store";
import { createRateLimiter } from "./rateLimit";

export type AiCaller = { ok: true; mode: "user" | "staff" | "secret"; userId: string | null } | { ok: false; response: NextResponse };

/** Per-account / per-secret budget so one session cannot drain the Gemini quota. */
export const aiCallerLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 60 });

export const SIGN_IN_REPLY = {
  en: "Please sign in to chat with Dr. Mohamed · Munzer's assistant, MathMentor's AI tutor.",
  ar: "سجّل الدخول للدردشة مع الدكتور محمد · مساعد منذر، المعلّم بالذكاء الاصطناعي في MathMentor.",
};

export const UPGRADE_REPLY = {
  en: "AI chat with Dr. Mohamed · Munzer's assistant is part of the AI subscription. Activate a card or subscribe to continue.",
  ar: "دردشة الدكتور محمد · مساعد منذر الذكية ضمن اشتراك الذكاء الاصطناعي. فعّل بطاقة أو اشترك للمتابعة.",
};

function nextPathFrom(request: Request) {
  const referer = request.headers.get("referer");
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return "/";
  }
}

export async function authorizeAiCaller(request: Request): Promise<AiCaller> {
  const agent = await authorizeAgentRequest(request);
  let caller: AiCaller | null = null;
  if (agent.ok && (agent.mode === "secret" || agent.mode === "staff")) {
    caller = { ok: true, mode: agent.mode, userId: null };
  }
  if (!caller) {
    const guard = await apiSession();
    if (guard.error) {
      const next = nextPathFrom(request);
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            needSignIn: true,
            signInUrl: `/login?next=${encodeURIComponent(next)}`,
            reply: `${SIGN_IN_REPLY.ar}\n${SIGN_IN_REPLY.en}`,
            error: SIGN_IN_REPLY.en,
            errorAr: SIGN_IN_REPLY.ar,
          },
          { status: 401 },
        ),
      };
    }
    const user = guard.live.user;
    if (isStaffRole(user.role)) caller = { ok: true, mode: "staff", userId: user.id };
    else if (await userHasAiAccess(user)) caller = { ok: true, mode: "user", userId: user.id };
    else {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            needAi: true,
            upgradeUrl: "/redeem?need=ai",
            reply: `${UPGRADE_REPLY.ar}\n${UPGRADE_REPLY.en}`,
            error: UPGRADE_REPLY.en,
            errorAr: UPGRADE_REPLY.ar,
          },
          { status: 403 },
        ),
      };
    }
  }
  const key = caller.userId ? `u:${caller.userId}` : `m:${caller.mode}`;
  const hit = aiCallerLimiter.hit(key);
  if (!hit.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reply: "محاولات كثيرة، حاول بعد قليل. / Too many messages, try again shortly.", retryAfterSec: hit.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
      ),
    };
  }
  return caller;
}
