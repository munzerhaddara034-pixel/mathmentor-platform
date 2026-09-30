/** Server helper: issue a verification token for a pending account and e-mail the link. */
import { sendEmail } from "@/lib/email/sender";
import { verificationEmail, verificationLink } from "./emailVerification";
import { issueEmailVerification } from "./store";

export async function sendVerificationEmail(
  userId: string,
  requestUrl: string,
  opts: { force?: boolean } = {},
): Promise<{ sent: boolean; skipped: boolean; provider?: string }> {
  const issued = await issueEmailVerification(userId, { force: opts.force });
  if (!issued) return { sent: false, skipped: true };
  const link = verificationLink(issued.token, new URL(requestUrl).origin);
  const message = verificationEmail({ name: issued.user.name, link });
  const result = await sendEmail({ to: issued.user.email, ...message });
  if (!result.ok) console.warn(`[mathmentor] verification e-mail not sent (${result.provider}): ${result.error ?? "unknown"}`);
  return { sent: result.ok, skipped: false, provider: result.provider };
}
