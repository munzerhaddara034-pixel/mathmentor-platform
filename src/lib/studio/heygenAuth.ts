import { NextResponse } from "next/server";

/**
 * There is no login in this build. If `HEYGEN_ADMIN_TOKEN` (or `ADMIN_TOKEN`)
 * is set, generate/list routes require that bearer / x-admin-token header.
 * Otherwise the route stays open and the API returns a demoMode notice.
 */
export function adminToken() {
  return process.env.HEYGEN_ADMIN_TOKEN?.trim() || process.env.ADMIN_TOKEN?.trim() || "";
}

export function requestAdminToken(request: Request) {
  const header = request.headers.get("x-admin-token")?.trim();
  if (header) return header;
  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const url = new URL(request.url);
  return url.searchParams.get("token")?.trim() || "";
}

export type HeyGenGuard =
  | { ok: true; demoAuth: boolean; notice: string }
  | { ok: false; response: NextResponse };

export function guardHeyGenAdmin(request: Request, { write }: { write: boolean }): HeyGenGuard {
  const required = adminToken();
  const notice = required
    ? "Teacher/admin token accepted."
    : "Demo mode: this build has no teacher login. Generation is open locally. Set HEYGEN_ADMIN_TOKEN to require a bearer token.";
  if (!required) {
    return { ok: true, demoAuth: true, notice };
  }
  const provided = requestAdminToken(request);
  if (provided && provided === required) {
    return { ok: true, demoAuth: false, notice };
  }
  if (!write) {
    return { ok: true, demoAuth: true, notice: "Read allowed. Write routes require HEYGEN_ADMIN_TOKEN." };
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: "Teacher/admin token required.", demoMode: false },
      { status: 401 },
    ),
  };
}

export function webhookSecretOk(request: Request, body: unknown): boolean {
  const secret = process.env.HEYGEN_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const url = new URL(request.url);
  const bodySecret =
    body && typeof body === "object" && "secret" in body ? String((body as { secret?: unknown }).secret ?? "") : "";
  const candidates = [
    request.headers.get("x-heygen-signature"),
    request.headers.get("x-webhook-secret"),
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""),
    url.searchParams.get("secret"),
    bodySecret,
  ];
  return candidates.some((value) => Boolean(value) && value === secret);
}
