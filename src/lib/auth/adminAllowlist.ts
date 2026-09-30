/**
 * Staff rights come from env allowlists — never from seeded accounts or stored passwords.
 *
 * - ADMIN_EMAILS (comma-separated, case-insensitive, trimmed): these emails get the admin role
 *   (staff: teacher + admin powers) when they sign up, and again on login if the account exists.
 *   When ADMIN_EMAILS is unset or blank, the documented fallback is DEFAULT_ADMIN_EMAIL.
 * - TEAM_APPROVER_EMAILS (same format): who may click «موافقة ونشر» in /admin/team.
 *   When unset or blank it falls back to the ADMIN_EMAILS allowlist.
 *
 * Admin rights activate only after the allowlisted address is verified (confirmation link +
 * password at login; see src/lib/auth/emailVerification.ts). Accounts that existed before e-mail
 * verification shipped are grandfathered as verified.
 */

/** Documented fallback for ADMIN_EMAILS only — not a stored account and never has a password. */
export const DEFAULT_ADMIN_EMAIL = "munzerhaddara2@gmail.com";

export function parseEmailList(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function adminEmails(): string[] {
  const list = parseEmailList(process.env.ADMIN_EMAILS);
  return list.length ? list : [DEFAULT_ADMIN_EMAIL];
}

export function isAdminEmail(email: string | undefined | null): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return adminEmails().includes(normalized);
}

export function teamApproverEmails(): string[] {
  const list = parseEmailList(process.env.TEAM_APPROVER_EMAILS);
  return list.length ? list : adminEmails();
}

export function isTeamApproverEmail(email: string | undefined | null): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return teamApproverEmails().includes(normalized);
}
