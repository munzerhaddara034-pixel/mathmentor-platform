# Multi-region pricing · تسعير متعدد المناطق

**Brand:** Prof. Munzer Haddara / الأستاذ منذر حداره only — never Al-Tarah / الطارة.

**Updated:** 6 Oct 2026 (Asia/Beirut) — **pricing v2** approved by Munzer.

**Single price source:** `src/lib/pricing/plans.ts` (`REGIONAL_PRICING`). Checkout (`resolvePlanAmount`), the
"I paid" form, `/subscribe`, the student page, the home plan cards, live-booking defaults and the activation-code
revenue estimate all read from it. `src/lib/settings.ts` keeps only the legacy activation-code plan ids / names /
access tier, **without prices**; checkout refuses those legacy ids.

**Principle:** a live session with Prof. Munzer is sold on its own. Platform subscribers pay less per session than
outside students. **Platform + 4 sessions** (`liveHybrid`) = 4 × subscriber session price, so the platform is free
inside the bundle.

## Regions (`src/lib/pricing/plans.ts` · `REGIONAL_PRICING`)

| Region | Digital subscription / mo | Subscriber session | Platform + 4 sessions / mo | Outside-student session | Notes |
|---|---|---|---|---|---|
| **Lebanon** | $15 | $15 | **$60** (was $35) | $25 | Official Lebanese curriculum |
| **GCC** (SA/AE/QA/KW) | $42 ≈130–190 SAR | $30 | **$120** (was $110) ≈450 SAR | $50 | قدرات / تحصيلي / مسارات الثانوي / مناهج الوزارة |
| **International** (IB / Cambridge) | $60–85 (charge **72**) | $50 | **$200** (was $185) | $70–100 (charge **85**) | KaTeX / academic precision |
| **US Admissions** (SAT / ACT / AP) | $45–65 (charge **55**) | $37 | **$148** (was $135) | $50–75 (charge **62**) | Speed / strategies / justification |

Fields: `plans[digitalCore]`, `subscriberSessionUsd`, `plans[liveHybrid]` (fixed, no band), `privateTutoringHour*`
(outside-student session). Term = monthly charge × 2.5 (rounded). `/subscribe` shows the four options per region
(`PricingOptions`). Live booking (`/live`, Lebanon) defaults to `subscriberSessionUsd` / `outsideSessionUsd`;
`LIVE_SESSION_PRICE_USD` / `LIVE_SESSION_PRICE_EXTERNAL_USD` env vars can still override them.

### Curriculum → pricing region

| Curriculum family | Pricing region |
|---|---|
| Lebanese | `lebanon` (default Whish) |
| GCC | `gcc` (default Western Union) |
| IB / Cambridge | `international` |
| AP / SAT·ACT | `admissions_us` |

Region selector labels: **Lebanon | GCC | International (IB/Cambridge) | US Admissions (SAT/ACT/AP)**.

## B2B Gulf schools (`src/lib/b2b/pricingStudy.ts` · `schools_b2b`)

- **$12–18 / student / month**, minimum **40** students
- Includes: school dashboard + teacher training; school-wide exam review sessions; term/annual school budget contracts
- Quote helper `schoolB2bQuote()` uses mid-band ($15) and enforces min 40

## Payment methods

`paymentMethod` on billing orders: `whish` | `western_union` | `omt`.

Whish wallet stays **96170772968** باسم منذر أحمد حداره. Instructor WhatsApp allowlist **96176532421** is unchanged.
