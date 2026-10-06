# Payments — "I paid" (Whish / OMT, USD) with admin confirmation

Students pay by manual transfer, then report it on **/wallet/pay**. Nothing activates until the
**admin** (role `admin`, verified e-mail) presses **Confirm** on **/admin/payments**.

## Owner decisions (2026-10)

| Topic | Decision |
| --- | --- |
| Currency | USD only (`currency = 'USD'` CHECK). No LBP. |
| Who activates | Admin only. Teachers cannot confirm (also enforced on the legacy `/api/billing/confirm-payment` `teacher_confirm`). |
| Expiry | Monthly = 30 days, term = 90 days, extended from the current expiry when it is still active. Admin may override the date in the Confirm dialog (future, ≤ 400 days). |
| Owner alerts | WhatsApp 96176532421 + e-mail munzerhaddara2@gmail.com (receipt attached). |
| Payment number | Whish and OMT: 70772968, beneficiary منذر أحمد حداره (configurable). |
| Duplicate reference | Partial unique index on `(method, reference)` for `pending` / `confirmed` rows only → resubmission allowed after a rejection. |
| Receipts | Kept 12 months after review, then the bytes are dropped (hash + metadata stay). |
| Parents | Cannot submit for now (403); staff cannot submit either. |

## Flow

1. Student opens `/wallet/pay`, picks region / plan / period (amount prefilled in USD), method, reference,
   transfer date, optional receipt (JPEG / PNG / WebP ≤ 5 MB, checked by magic bytes; the browser
   downsizes big photos to ≤ 1600 px JPEG first).
2. `POST /api/payments` (multipart, same-origin, rate-limited 5/h + 20/day per user, 20/h per IP) inserts a
   **pending** row + receipt + `payment.submit` audit row in one transaction, then alerts the owner.
3. Admin reviews on `/admin/payments` (pending / confirmed / not received tabs, receipt viewer, amount
   mismatch + reused-receipt flags, current AI expiry).
4. **Confirm** (`POST /api/admin/payments/:id/confirm`): one transaction locks the payment row and the
   `auth.json` document, applies the plan once, records `period_start` / `period_end`, writes
   `payment.confirm` to `mm_audit_log`. Repeats / double clicks / two admins → `alreadyConfirmed`, no change.
5. **Not received** (`POST /api/admin/payments/:id/reject`, note required) → `payment.reject` audit row,
   student notified; the same reference can then be submitted again.

Student result goes to in-app + e-mail + WhatsApp (only to the phone the student actually entered or saved).

## Environment variables

All optional; defaults in parentheses. Admin settings saved on `/admin/payments` win over env.

| Var | Purpose |
| --- | --- |
| `PAYMENTS_WHISH_NUMBER` | Whish number shown to students (70772968). Also used in booking / subscription WhatsApp texts. |
| `PAYMENTS_OMT_NUMBER` | OMT number (70772968). |
| `PAYMENTS_WHISH_ENABLED` / `PAYMENTS_OMT_ENABLED` | `0` / `false` hides a method (enabled). |
| `PAYMENTS_BENEFICIARY_NAME_AR` / `_EN` | Beneficiary (منذر أحمد حداره / Munzer Ahmad Haddara). |
| `PAYMENTS_OWNER_WHATSAPP` | Owner alert WhatsApp (96176532421). |
| `PAYMENTS_OWNER_EMAIL` | Owner alert e-mail (munzerhaddara2@gmail.com). |

Already-existing vars the feature relies on: `DATABASE_URL` (payments need Postgres; without it the
routes answer 503), `RESEND_API_KEY` + `EMAIL_FROM` (e-mail), the WhatsApp provider vars, and
`NEXT_PUBLIC_APP_URL` (links in alerts + Origin check behind proxies).

## Database (migrations 007 / 008, auto-applied on boot, re-runnable)

- `mm_payments` — one row per claim (see `src/lib/db/schema.ts`).
- `mm_payment_receipts` — receipt bytes (`bytea`), `sha256`, `purged_at`. Not granted to the finance role.
- View `mm_finance_subscriptions` — per student: plan, `ai_expires_at`, `paid_until`, `last_paid_at`,
  `pending_count`, `lifetime_paid_usd`, `expires_at`, `finance_status` (`never_paid` / `overdue` /
  `expiring_soon` (≤ 7 days) / `active`).

## Admin finance summary API

`GET /api/admin/finance/summary` — same **admin session** auth as `/api/admin/payments`
(`apiRequireAdmin`: signed-in role `admin` + verified e-mail). Returns **aggregates only**
(no receipts, no payment rows, no payer PII):

- `mm_payments`: `count` + `sum_amount` by status (`pending` / `confirmed` / `rejected`)
- `mm_finance_subscriptions`: counts by `finance_status`
- `totals.lifetime_confirmed_usd` (USD) and `totals.subscriber_count` (students with `finance_status = active`)

`GET /api/finance/summary` — same aggregate payload for the CFO agent, authenticated with `Authorization: Bearer <token>` matched in constant time against env var `MM_FINANCE_READ_TOKEN` (unset → 503, missing/wrong → 401, non-GET → 405, 30 req/min per IP, `Cache-Control: no-store`).

## Read-only finance role (manual, Neon)

Migrations never create roles or passwords. Once, in the Neon SQL editor (as the database owner):

```sql
CREATE ROLE mm_finance_ro LOGIN PASSWORD '<generate a strong password>' CONNECTION LIMIT 3;
ALTER ROLE mm_finance_ro SET default_transaction_read_only = on;
ALTER ROLE mm_finance_ro SET statement_timeout = '15s';
```

Then redeploy (or run `npm run db:migrate`): migration 008 sees the role and runs

```sql
GRANT USAGE ON SCHEMA public TO mm_finance_ro;
GRANT SELECT ON mm_payments, mm_finance_subscriptions TO mm_finance_ro;
```

(you may also run those two GRANTs by hand). It gets no access to `mm_documents`, `mm_payment_receipts`,
`mm_audit_log` or anything else. Store its connection string only in the finance tool, never in the app.

## Tests

- `tests/payments.test.mjs` — validation, upload validation, expiry, notifications, settings, migration text.
- `tests/paymentsLockdown.test.mjs` — static guarantees (no auto-activation, admin-only, parents blocked).
- `tests/paymentsPg.test.mjs` — real Postgres; skipped unless `MM_TEST_PG_URL` points at a **throwaway**
  server (a fresh database is created and dropped per run; it never reads `DATABASE_URL`):

```bash
MM_TEST_PG_URL=postgres://user@127.0.0.1:55432/postgres npm test
```

## Known limits

- `/api/cards` scratch-card creation is still allowed for teachers; redeeming a card activates a plan
  without an admin. Restrict it if teacher activation must be impossible everywhere.
- The owner's WhatsApp copy of the receipt goes through `sendWhatsAppMedia`, which keeps a copy in the
  instance's (ephemeral) media outbox.
