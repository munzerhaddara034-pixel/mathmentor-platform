/** Client helpers for /api/admin/team — every call is wrapped in try/catch and returns an Arabic error. */
import type { TeamMessage, TeamProposal, TeamSendResponse, TeamThreadResponse } from "@/lib/team/types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; errorAr: string };

type ErrorBody = { errorAr?: unknown; error?: unknown };

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const err = (body ?? {}) as ErrorBody;
    const errorAr =
      typeof err.errorAr === "string"
        ? err.errorAr
        : response.status === 401
          ? "انتهت الجلسة — سجّل الدخول مجدداً."
          : `تعذّر الطلب (${response.status}).`;
    return { ok: false, errorAr };
  }
  return { ok: true, data: body as T };
}

async function safe<T>(run: () => Promise<Response>): Promise<ApiResult<T>> {
  try {
    return await parse<T>(await run());
  } catch {
    return { ok: false, errorAr: "تعذّر الاتصال بالخادم. تحقّق من الشبكة وحاول مجدداً." };
  }
}

export function fetchThread(channel: string) {
  return safe<TeamThreadResponse>(() =>
    fetch(`/api/admin/team/messages?channel=${encodeURIComponent(channel)}`, { cache: "no-store" }),
  );
}

export function sendTeamMessage(channel: string, text: string, files: File[]) {
  const form = new FormData();
  form.set("channel", channel);
  form.set("text", text);
  for (const file of files) form.append("files", file, file.name);
  return safe<TeamSendResponse>(() => fetch("/api/admin/team/messages", { method: "POST", body: form }));
}

export function transcribeVoice(blob: Blob, filename: string) {
  const form = new FormData();
  form.set("audio", blob, filename);
  return safe<{ ok: true; text: string; warning?: string }>(() =>
    fetch("/api/admin/team/transcribe", { method: "POST", body: form }),
  );
}

export type DecisionBody = { action: "approve" | "reject"; confirm: true; branch?: string; confirmBranch?: string };

export function decideProposal(id: string, body: DecisionBody) {
  return safe<{ ok: true; proposal: TeamProposal; message: TeamMessage }>(() =>
    fetch(`/api/admin/team/proposals/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export function attachmentUrl(id: string) {
  return `/api/admin/team/attachments/${encodeURIComponent(id)}`;
}
