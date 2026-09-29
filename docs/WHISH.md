# Whish Money payments · دفع Whish (اشتراكات + حصص)

**EN** · MathMentor · أكاديمية منذر حداره · Instructor: **Munzer Ahmad Haddara / منذر أحمد حداره**

Munzer does **not** use Whish merchant API keys. **All money** (subscriptions + live sessions) uses a **manual Whish transfer** flow. Never brand as الطارة / Al-Tarah.

## Destination (unchanged)

| Field | Value |
|---|---|
| Phone | **`96170772968`** |
| Name AR | **منذر أحمد حداره** |
| Name EN | **Munzer Ahmad Haddara** |

WhatsApp academy numbers are for **support / contact only** — never as a payment CTA.

## Subscriptions (`/subscribe`)

1. Student signs in and opens `/subscribe`.
2. Chooses a plan + **monthly** or **term** amount (`usdMonthly` / `usdTerm` from settings).
3. `POST /api/billing/subscribe-request` → `{ planId, period }` creates a Whish order `pending_payment`.
4. UI shows shared **WhishCheckout** with the **exact plan amount**, phone, name, AR+EN steps.
5. UltraMsg WhatsApp + in-app notify the teacher (student, plan, amount, order id).
6. Student taps **I've transferred** → status `transfer_claimed`, teacher pinged again.
7. Teacher confirms (`POST /api/billing/confirm-payment` with `teacher_confirm`) → activates `subscriptionType` / live credits (same path as redeem activation) for 30 days (monthly) or 90 days (term).
8. Scratch cards on `/redeem` remain an **optional post-payment unlock** (or teacher confirm auto-activates).

### APIs

| Route | Auth | Body / notes |
|---|---|---|
| `POST /api/billing/subscribe-request` | Logged-in | `{ planId, period: "monthly" \| "term" }` |
| `POST /api/billing/confirm-payment` | Owner or staff | `{ orderId, action: "student_mark" \| "teacher_confirm" }` |
| `GET /api/billing/orders?pending=1` | Logged-in | Staff sees all pending; students see own |

Teacher UI: pending list on `/subscribe` and staff section on `/live`.

## Live sessions (`/live`)

Dual pricing unchanged:

| Audience | Amount |
|---|---|
| **Platform member** | **$15 USD** |
| **Outside platform** | **$25 USD** |

Flow: `POST /api/live/book` → `pending_payment` → Whish instructions → student mark / teacher confirm via `POST /api/live/confirm-payment`.

## Shared helpers & UI

- `src/lib/whish/client.ts` — `whishTransferInstructions`, `whishTransferInstructionsForAmount`, dual live prices
- `src/components/billing/WhishCheckout.tsx` — amount, phone, name, steps AR+EN, I've transferred
- `src/lib/billing/orders.ts` — subscription Whish orders store (`whish-orders.json`)

## Netlify environment

| Variable | Value |
|---|---|
| `WHISH_TRANSFER_PHONE` | `96170772968` |
| `WHISH_TRANSFER_NAME` | `منذر أحمد حداره` |
| `WHISH_ENABLED` | `1` |
| `TEACHER_WHATSAPP` | `96170772968` |
| `LIVE_SESSION_PRICE_USD` | `15` |
| `LIVE_SESSION_PRICE_EXTERNAL_USD` | `25` |
| `WHATSAPP_PROVIDER` | `ultramsg` (if secrets set) |
| `ULTRAMSG_INSTANCE_ID` / `ULTRAMSG_TOKEN` | from UltraMsg |

Without UltraMsg/Twilio, WhatsApp is **logged** to the outbox; orders still succeed.

**Do not set** `WHISH_SECRET` / `WHISH_CHANNEL` for this flow — unused.

## Arabic summary · ملخص عربي

- كل الأموال عبر Whish إلى **96170772968** باسم **منذر أحمد حداره**.
- الاشتراكات من `/subscribe` · الحصص من `/live`.
- واتساب للدعم فقط، ليس للدفع.
- الأستاذ يؤكد التحويل فيتم تفعيل الباقة أو الحصة.


## Western Union & OMT (manual)

In addition to Whish, `/subscribe` accepts **Western Union** and **OMT** manual transfers (especially for GCC / international).

| Method | Beneficiary | Notes |
|---|---|---|
| Whish | `96170772968` · منذر أحمد حداره | Default for Lebanon |
| Western Union | منذر أحمد حداره / Munzer Ahmad Haddara | Set `WU_BENEFICIARY_*` in env |
| OMT | منذر أحمد حداره / Munzer Ahmad Haddara | Set `OMT_BENEFICIARY_*` in env |

Orders store `paymentMethod`: `whish` | `western_union` | `omt`. No auto-API — student marks transferred, teacher confirms.

Regional plan prices live in `src/lib/pricing/plans.ts` (`REGIONAL_PRICING`) and switch with the curriculum region on `/subscribe`.
