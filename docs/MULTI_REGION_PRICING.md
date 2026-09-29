# Multi-region pricing · تسعير متعدد المناطق

**Brand:** Prof. Munzer Haddara / الأستاذ منذر حداره only — never Al-Tarah / الطارة.

**Updated:** 23 Sep 2026 (Asia/Beirut) — USD bands + `defaultChargeUSD` (midpoint) for checkout.

## Regions (`src/lib/pricing/plans.ts` · `REGIONAL_PRICING`)

| Region | Digital Core | Live Hybrid | Private hour | Notes |
|---|---|---|---|---|
| **Lebanon** | $15 / mo (fixed) | $35 / mo (الأكثر طلباً) | $25 | Official Lebanese curriculum |
| **GCC** (دول الخليج · SA/AE/QA/KW) | **$42** / mo (midpoint of $35–50) ≈130–190 SAR | **$110** / mo ≈340–490 SAR | **$50** / hr | Fixed midpoint checkout; قدرات / تحصيلي / مسارات الثانوي / مناهج الوزارة |
| **International** (IB DP Math HL/SL, Cambridge IGCSE/A-Level) | $60–85 (default **72**) | $150–220 (default **185**) | $70–100 (default **85**) | KaTeX / academic precision value |
| **US Admissions** (SAT / ACT Math / AP Calculus) | $45–65 (default **55**) | $110–160 (default **135**) | $50–75 (default **62**) | Intensive speed / strategies / math justification |

Cards on `/subscribe`: **Lebanon & GCC** show fixed USD (GCC = policy midpoint). **International & US Admissions** show USD bands with checkout at `defaultChargeUSD` (midpoint). GCC still shows SAR approx ranges. Term = monthly charge × 2.5 (rounded).

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
