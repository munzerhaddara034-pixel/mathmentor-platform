# B2B Ops · مدير العمليات والشراكات الذكي

**Brand / العلامة:** Prof. Munzer Haddara / الأستاذ **منذر حداره** only. Never Al-Tarah / الطارة.

Staff-only route: `/admin/b2b-manager` (`requireStaff` via `/admin` layout).

## Features

### A) School proposal generator
- Inputs: school name, certificate student count, curriculum `Lebanese` | `International`.
- `POST /api/admin/b2b/proposal` → Gemini refine when `GEMINI_API_KEY` / `GOOGLE_API_KEY` is set; otherwise a strong Arabic formal template.
- Printable HTML + Print button (`@media print` hides nav/forms/ops).
- Covers discounts, interactive features, exam-success role, B2B quote (`$12–18`/student/mo mid-band, min 40).

### B) Whish payment ops
- Wallet: `whishTransferPhone()` / `whishTransferNameAr()` — default **96170772968** باسم **منذر أحمد حداره**.
- Fields: Reference ID, optional note, plan/amount.
- Confirm → persists `data/b2b-whish-payments.json` (or Netlify Blobs) + `notifyStaff` (`kind: whish_payment`) to activate account & generate subscription card.
- **Whish only** — no other payment rails on this panel.

### C) Pricing study (exact)
Source of truth: `src/lib/b2b/pricingStudy.ts` + bilingual UI table.

| Plan | Price |
|------|-------|
| Digital Basic | $10–15/mo or $75 school year |
| Gold | $25–35/mo · full platform + 4 group live/mo |
| Schools B2B (Gulf) | $12–18/student/mo min 40 · dashboard + teacher training · school-wide exam reviews · term/annual contracts |
| 1-on-1 in-person | $15–25/hour by area |
| Semi-private groups | $5–8/student/hour · 4–6 students |

### D) Wiring
- Links from `/admin` and staff `Nav` → `/admin/b2b-manager`.
- Modular TS under `src/lib/b2b/*` and `src/components/admin/b2b/*` — no `any`.
- Skeleton loaders on async proposal / payment UI.

## How to test (staff account)

1. Open the live / draft URL.
2. Login: a staff account (email in `ADMIN_EMAILS`).
3. Nav → **الشراكات** or `/admin/b2b-manager`.
4. Generate a school proposal → Print.
5. Record a Whish Reference ID → Confirm → check notification bell + recent list.
6. Verify pricing table matches `pricingStudy.ts`.

APIs (staff session cookie required):
- `POST /api/admin/b2b/proposal`
- `GET|POST /api/admin/b2b/whish-confirm`
