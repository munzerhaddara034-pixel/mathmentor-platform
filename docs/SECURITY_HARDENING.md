# Security hardening (branch `security-hardening`)

## What changed

| Area | Change |
| --- | --- |
| Signup e-mail verification | New signups get **no session**. A confirmation link (`/login?verify=<token>`, 24 h, stored only as a SHA-256 hash) is e-mailed; the account activates when the link is opened **and** the password is entered at login. ADMIN_EMAILS addresses get admin rights only after that verification. |
| Grandfathering | Accounts created before this change have no `emailVerifiedAt` field and are treated as verified — existing logins (including the owner's) keep working. |
| E-mail squatting | Signing up again with a never-verified address replaces the pending password; the link only works together with the password, so a squatter can't verify their password with the owner's link. New-style accounts no longer use the profile-DB password fallback at login. |
| Rate limiting (in memory, per instance) | Login: 30 attempts / 15 min per IP, 10 failed attempts / 15 min per e-mail (reset on success) → HTTP 429 + `Retry-After`. Signup: 10 / hour per IP. Verification e-mails: at most one every 5 minutes per account. |
| Destructive operations | `DELETE /api/live/slots` (the only API route that deleted stored rows) is now **admin-only** and is written to the append-only audit log **before** the delete runs. |
| Audit log | Migration `005_audit_log`: `CREATE TABLE IF NOT EXISTS mm_audit_log` plus a trigger that rejects UPDATE/DELETE. Without Postgres, entries go to the `audit-log.json` document. Each entry is also logged as `[mathmentor][audit] {…}`. |
| Unauthenticated writes closed | `/api/assistant` (GET/POST), `/api/assistant/review`, `POST /api/exams`, `POST/PATCH /api/questions`, `POST /api/library`, `POST /api/library/ingest-ahlia`, `GET /api/library/file/[id]` → staff only. `POST /api/solve-math/gemini` → signed-in AI tier (it spent the Gemini key for anyone). |
| `/api/content` data leak | Was public and returned the whole store, including **unused scratch-card redemption codes**, entitlements (names/phones), manager chat and outreach. Now needs a session; non-staff get only library/drafts/settings/progress/lessons/questions/exams/studentChat, and library file paths are removed. |
| Live guest links | Middleware only lets a `mm_live_guest` cookie skip the login redirect if it looks like a signed token. The classroom page now also checks that a guest's booking matches the room. The token API and whiteboard API already verified HMAC, expiry, booking and room. |
| Agent APIs | `authorizeAgentRequest` no longer allows anonymous "demo" mode in production (unless `AGENT_ALLOW_DEMO_MODE=1`). Secret comparisons are constant-time. |
| WhatsApp webhooks | One provenance check for every provider (`src/lib/security/webhookProvenance.ts`): Meta `X-Hub-Signature-256` (HMAC-SHA256, `WHATSAPP_APP_SECRET`), Twilio `X-Twilio-Signature` (HMAC-SHA1 over URL + sorted params, `TWILIO_AUTH_TOKEN`), UltraMsg shared secret (`?secret=` / `x-webhook-secret` = `WHATSAPP_WEBHOOK_SECRET` or `AGENT_WEBHOOK_SECRET`, constant-time). Configured secret + bad/missing signature → 401. A provider that cannot be verified yet is accepted for maths help only: **no privileged actions** (WhatsApp approvals, code changes) and a loud log warning. When Meta is the provider and its secret is set, unsigned UltraMsg/Twilio-shaped payloads are refused. Provider media credentials go only to the provider's own https hosts (parsed hostname allowlist, from 5f2856b). |
| Code evolution (release-2026-10-01) | Chat widget / voice route code evolution (`executeCodeEvolution`) is **disabled**: it replies "disabled" and never claims success. Agent Hub / WhatsApp code-evolution proposals can be created and listed but are **never committed**, and «ok/موافق» skips them. All agent commit helpers refuse `main`, `master`, `agent-hub-latest`, the old live branch, Render's `GITHUB_BRANCH`, and anything not `feat/` `fix/` `chore/` `docs/` (`src/lib/security/agentBranches.ts`). Hamza (`/admin/team`) can no longer target the live branch by typing its name. |
| Headers (all routes) | Enforced: `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Permissions-Policy` (camera/mic self). Full CSP is **Report-Only** (see `src/lib/security/headers.ts`). `X-Powered-By` is removed. |
| npm audit | `postcss` < 8.5.23 (high, nested under `next`) → `overrides.postcss = ^8.5.28`. That also clears the moderate `next` advisory, which only came from its postcss dependency. `npm audit` now reports 0. |

## Env vars to set on Render

* `RESEND_API_KEY` and `EMAIL_FROM` (for example `MathMentor <no-reply@your-verified-domain>`). Without them, new signups can't receive the link.
  * One-off bootstrap: `EMAIL_DEV_LOG_LINKS=1` writes the links to the Render log. Unset it afterwards.
* `APP_BASE_URL`, the public https origin used in the confirmation links (optional; falls back to `NEXT_PUBLIC_APP_URL`, then the request origin).
* `WHATSAPP_APP_SECRET` (Meta app → Settings → Basic → App secret). Enables webhook signature checks; until it is set, WhatsApp approvals are refused (use Agent Hub) and the log warns every 10 minutes. (5f2856b's "503 when unset" rule was deliberately not adopted: it would silence the live WhatsApp agent the moment this deploys.)
* `WHATSAPP_WEBHOOK_SECRET` only if UltraMsg is used (append `?secret=<value>` to its webhook URL); `TWILIO_AUTH_TOKEN` enables Twilio signature checks.
* Recommended: `AGENT_WEBHOOK_SECRET` / `LIVE_JOIN_SECRET` (≥16 chars) and `JOBS_SECRET`, if they aren't set already.
