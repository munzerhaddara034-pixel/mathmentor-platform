/**
 * Secret hygiene for the team chat and developer commits (docs/TEAM_CHAT_SPEC.md §1.ج / §2.4).
 * - Human messages: secrets are redacted BEFORE storage and before any LLM sees them.
 * - Developer proposals: any secret pattern or live env secret value blocks the commit.
 */

const SECRET_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "Meta/WhatsApp token (EAA…)", re: /\bEAA[A-Za-z0-9]{2,}[A-Za-z0-9…._-]*/g },
  { label: "GitHub token (ghp_)", re: /\bgh[pousr]_[A-Za-z0-9]{16,}/g },
  { label: "GitHub fine-grained token", re: /\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { label: "OpenAI-style key (sk-)", re: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{16,}/g },
  { label: "Google API key (AIza)", re: /\bAIza[0-9A-Za-z_-]{30,}/g },
  { label: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { label: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "Private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g },
  { label: "Postgres URL with password", re: /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@[^\s'"`]+/g },
];

/** Names of env vars whose live values must never appear in chat output or commits. */
const SECRET_ENV_KEYS = [
  "GITHUB_TOKEN",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
  "LLM_API_KEY",
  "DATABASE_URL",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "HEYGEN_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_API_KEY",
  "WHATSAPP_TOKEN",
  "ADMIN_TOKEN",
  "AGENT_WEBHOOK_SECRET",
  "HEYGEN_ADMIN_TOKEN",
  "HEYGEN_WEBHOOK_SECRET",
  "JOBS_SECRET",
  "TWILIO_AUTH_TOKEN",
  "ULTRAMSG_TOKEN",
  "ZOOM_CLIENT_SECRET",
  "WHISH_SECRET",
];

export const REDACTED_AR = "[سرّ محجوب]";

function liveSecretValues(): string[] {
  return SECRET_ENV_KEYS.map((key) => process.env[key]?.trim() || "").filter((value) => value.length >= 12);
}

/** Redacts secrets from human chat text. Returns the clean text and how many were removed. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(new RegExp(pattern.re.source, pattern.re.flags), () => {
      count += 1;
      return REDACTED_AR;
    });
  }
  for (const value of liveSecretValues()) {
    if (out.includes(value)) {
      count += out.split(value).length - 1;
      out = out.split(value).join(REDACTED_AR);
    }
  }
  return { text: out, count };
}

/** Findings for developer diffs; an empty list means the content is clean. */
export function scanForSecrets(content: string): string[] {
  const findings: string[] = [];
  for (const pattern of SECRET_PATTERNS) {
    if (new RegExp(pattern.re.source, pattern.re.flags).test(content)) findings.push(pattern.label);
  }
  if (liveSecretValues().some((value) => content.includes(value))) findings.push("قيمة متغير بيئة سرّي");
  return findings;
}

export function secretRotationNoticeAr(count: number): string {
  return (
    `⚠️ حُجب ${count === 1 ? "سرّ واحد" : `${count} أسرار`} من رسالتك ولم يُحفظ ولم يُرسل لأي وكيل. ` +
    "اعتبر هذا السرّ مكشوفاً: دوّره (rotate) فوراً وضع القيمة الجديدة في متغيرات البيئة على Render فقط."
  );
}
