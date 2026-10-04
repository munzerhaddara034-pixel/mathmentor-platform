/**
 * Pluggable transactional e-mail sender (no npm dependency).
 *
 * Provider selection (first match wins):
 *  1. RESEND_API_KEY (+ EMAIL_FROM, e.g. "MathMentor <no-reply@your-domain>") → https://api.resend.com
 *  2. EMAIL_DEV_LOG_LINKS=1, or NODE_ENV !== "production" → the message is written to the server log
 *     (bootstrap/dev only: anyone with log access can read the link).
 *  3. otherwise → "none": nothing is sent and the caller reports emailSent=false.
 *
 * SMTP is not bundled; add a provider here (e.g. nodemailer) if Resend is not wanted.
 */

/** Resend attachment: base64 content (total e-mail incl. attachments must stay under 40 MB). */
export type EmailAttachment = { filename: string; content: string };
export type EmailMessage = { to: string; subject: string; text: string; html?: string; attachments?: EmailAttachment[] };
export type EmailSendResult = { ok: boolean; provider: "resend" | "log" | "none"; error?: string; id?: string };

type Env = Record<string, string | undefined>;
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export function emailProvider(env: Env = process.env): EmailSendResult["provider"] {
  if (env.RESEND_API_KEY?.trim()) return "resend";
  if (env.EMAIL_DEV_LOG_LINKS === "1" || env.NODE_ENV !== "production") return "log";
  return "none";
}

export async function sendEmail(
  message: EmailMessage,
  opts: { env?: Env; fetchImpl?: FetchLike; log?: (line: string) => void } = {},
): Promise<EmailSendResult> {
  const env = opts.env ?? process.env;
  const provider = emailProvider(env);
  if (provider === "resend") {
    const from = env.EMAIL_FROM?.trim() || "MathMentor <onboarding@resend.dev>";
    const doFetch = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    try {
      const res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.attachments?.length ? { attachments: message.attachments } : {}),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { ok: false, provider, error: `resend ${res.status}: ${String(payload.message ?? "").slice(0, 160)}` };
      return { ok: true, provider, id: payload.id };
    } catch (error) {
      return { ok: false, provider, error: error instanceof Error ? error.message.slice(0, 160) : "send failed" };
    }
  }
  if (provider === "log") {
    const files = message.attachments?.length ? ` attachments=${message.attachments.map((item) => item.filename).join(",")}` : "";
    (opts.log ?? console.info)(`[mathmentor][email:dev-log] to=${message.to} subject=${JSON.stringify(message.subject)}${files}\n${message.text}`);
    return { ok: true, provider };
  }
  console.warn("[mathmentor][email] No e-mail provider configured (set RESEND_API_KEY + EMAIL_FROM). Message not sent.");
  return { ok: false, provider, error: "no_provider" };
}
