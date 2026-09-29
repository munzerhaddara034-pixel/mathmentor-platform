/**
 * Staff session OR shared webhook secret (AGENT_WEBHOOK_SECRET / JOBS_SECRET / UltraMsg patterns).
 */

import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";

export type AgentAuthOk = { ok: true; mode: "staff" | "secret" | "demo" };
export type AgentAuthFail = { ok: false; error: NextResponse };
export type AgentAuthResult = AgentAuthOk | AgentAuthFail;

function providedSecrets(request: Request): string[] {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return [
    request.headers.get("x-agent-webhook-secret")?.trim() || "",
    request.headers.get("x-webhook-secret")?.trim() || "",
    request.headers.get("x-jobs-secret")?.trim() || "",
    request.headers.get("x-ultramsg-token")?.trim() || "",
    bearer,
    url.searchParams.get("secret")?.trim() || "",
  ].filter(Boolean);
}

function configuredSecrets(): string[] {
  return [
    process.env.AGENT_WEBHOOK_SECRET?.trim() || "",
    process.env.JOBS_SECRET?.trim() || "",
    process.env.ULTRAMSG_TOKEN?.trim() || "",
    process.env.HEYGEN_WEBHOOK_SECRET?.trim() || "",
  ].filter(Boolean);
}

export async function authorizeAgentRequest(request: Request): Promise<AgentAuthResult> {
  try {
    const secrets = configuredSecrets();
    const provided = providedSecrets(request);
    if (secrets.length > 0 && provided.some((p) => secrets.includes(p))) {
      return { ok: true, mode: "secret" };
    }

    const guard = await apiSession();
    if (!guard.error && isStaffRole(guard.live.user.role)) {
      return { ok: true, mode: "staff" };
    }

    if (secrets.length === 0) {
      // Local / Netlify QA without secrets — allow demo pipeline (same spirit as JOBS_SECRET empty).
      return { ok: true, mode: "demo" };
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth error";
    return {
      ok: false,
      error: NextResponse.json({ ok: false, error: message }, { status: 500 }),
    };
  }
}

/** HeyGen / marketing completion webhook — secret optional when unset. */
export function agentWebhookSecretOk(request: Request, body: unknown): boolean {
  const secret =
    process.env.AGENT_WEBHOOK_SECRET?.trim() ||
    process.env.HEYGEN_WEBHOOK_SECRET?.trim() ||
    "";
  if (!secret) return true;
  const url = new URL(request.url);
  const bodySecret =
    body && typeof body === "object" && "secret" in body
      ? String((body as { secret?: unknown }).secret ?? "")
      : "";
  const candidates = [
    request.headers.get("x-agent-webhook-secret"),
    request.headers.get("x-heygen-signature"),
    request.headers.get("x-webhook-secret"),
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""),
    url.searchParams.get("secret"),
    bodySecret,
  ];
  return candidates.some((value) => Boolean(value) && value === secret);
}
