/** Client helpers for /api/admin/team — every call is wrapped in try/catch and returns a typed error. */
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import type { TeamMessages } from "@/lib/i18n/ns/team";
import type { HamzaActivity } from "@/lib/hamza/activityTypes";
import type { PublicHamzaTask } from "@/lib/hamza/tasks/types";
import type { TeamMessage, TeamProposal, TeamSendResponse, TeamThreadResponse } from "@/lib/team/types";

/** Server text (Arabic, sometimes English) when the API sent one; otherwise a client key for the UI to translate. */
export type TeamApiError = { errorAr?: string; error?: string; key?: "session" | "status" | "network"; status?: number };

export type ApiResult<T> = { ok: true; data: T } | ({ ok: false } & TeamApiError);

/** Text for the active locale: translated client errors; server text in ar (Arabic) or English when provided. */
export function teamErrorText(err: TeamApiError, locale: Locale, t: TeamMessages): string {
  if (err.key === "session") return t.errors.session;
  if (err.key === "network") return t.errors.network;
  if (locale === "ar" && err.errorAr) return err.errorAr;
  if (locale !== "ar" && err.error) return err.error;
  if (err.key === "status" || !err.errorAr) return fmt(t.errors.status, { status: err.status ?? 0 });
  return err.errorAr;
}

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
    const errorAr = typeof err.errorAr === "string" ? err.errorAr : undefined;
    const error = typeof err.error === "string" ? err.error : undefined;
    if (errorAr || error) return { ok: false, errorAr, error, status: response.status };
    return { ok: false, key: response.status === 401 ? "session" : "status", status: response.status };
  }
  return { ok: true, data: body as T };
}

async function safe<T>(run: () => Promise<Response>): Promise<ApiResult<T>> {
  try {
    return await parse<T>(await run());
  } catch {
    return { ok: false, key: "network" };
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

export type ProposalActionBody =
  | { action: "issue_code"; confirm: true; step: "open_pr" | "merge"; branch?: string }
  | { action: "approve"; confirm: true; code: string; reviewed: boolean; allowLarge?: boolean; branch?: string }
  | { action: "merge"; confirm: true; code: string; typedBranch: string }
  | { action: "revise"; confirm: true; text: string }
  | { action: "reject" | "refresh_ci" | "revert"; confirm: true };

export type ProposalActionResponse = { ok: true; proposal: TeamProposal; message?: TeamMessage; code?: string; expiresAt?: string; task?: PublicHamzaTask };

/** Every Hamza decision (codes, approvals, merge, reject, CI refresh, revert) — same-origin JSON POST. */
export function proposalAction(id: string, body: ProposalActionBody) {
  return safe<ProposalActionResponse>(() =>
    fetch(`/api/admin/team/proposals/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    }),
  );
}

export function attachmentUrl(id: string) {
  return `/api/admin/team/attachments/${encodeURIComponent(id)}`;
}

/** Cancel a Hamza task, or continue a budget-paused one up to the max task budget. */
export function taskAction(id: string, action: "cancel" | "continue") {
  return safe<{ ok: true; task: PublicHamzaTask }>(() =>
    fetch(`/api/admin/team/tasks/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
  );
}

export function fetchHamzaActivity() {
  return safe<{ ok: true; activity: HamzaActivity }>(() => fetch("/api/admin/team/hamza/activity", { cache: "no-store" }));
}
