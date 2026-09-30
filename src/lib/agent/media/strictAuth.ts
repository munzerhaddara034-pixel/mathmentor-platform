/**
 * Staff session or AGENT_WEBHOOK_SECRET — never the "no secrets configured" demo bypass —
 * for endpoints that expose stored files or send real WhatsApp media.
 */
import { NextResponse } from "next/server";
import { authorizeAgentRequest } from "@/lib/agent/auth";

export async function requireStaffOrSecret(
  request: Request,
  options?: { allowDemo?: boolean },
): Promise<{ ok: true; mode: "staff" | "secret" | "demo" } | { ok: false; error: NextResponse }> {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth;
  if (auth.mode === "demo" && !options?.allowDemo) {
    return {
      ok: false,
      error: NextResponse.json(
        {
          ok: false,
          error: "Staff session or AGENT_WEBHOOK_SECRET required.",
          errorAr: "يلزم جلسة طاقم أو سر الوكيل AGENT_WEBHOOK_SECRET.",
        },
        { status: 401 },
      ),
    };
  }
  return auth;
}
