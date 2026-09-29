# Global multi-curriculum foundations

**Instructor:** Prof. Munzer Haddara / الأستاذ منذر حداره  
**Never:** Al-Tarah / الطارة

This release ships **architecture + UI + API** for international curriculum switching and a pedagogical AI tutor. Full content libraries for every curriculum are **not** required yet.

## What shipped

| Piece | Path |
| --- | --- |
| Schema + catalogs | `src/lib/curriculum/` |
| Persistence | `localStorage` key `mathmentor.curriculumId` + cookie `mm_curriculum` |
| Header switcher | `src/components/curriculum/CurriculumSwitcher.tsx` (in `Nav`) |
| React context | `CurriculumProvider` wraps the app in `src/app/layout.tsx` |
| Pedagogical tutor API | `POST /api/ai/pedagogical-tutor` |
| Tutor engine | `src/lib/curriculum/tutor.ts` |
| Light solver wiring | `/math-solver` banner + terminology + tutor panel |
| Exam hub hook | `ExamCurriculumHooks` + `curriculumHub` — see `docs/EXAMS_BAREME.md` |

## Curriculum schema

Stable ids (`CurriculumId`):

- `lebanese` — Brevet + Terminale **GS | LS | SE | LH** (default content)
- `saudi-gcc` — Mawhiba / Qudurat / Tahsili / MoE + UAE EmSAT + Qatar + Kuwait (**sample**)
- `ib` — AA / AI SL·HL (**sample**)
- `cambridge` — IGCSE / AS / A-Level (**planned**)
- `ap` — AP Calculus AB / BC (**planned**)
- `sat` — SAT / ACT Math (platform papers + College Board links)

Each definition includes:

- `grades[]`, `tracks[]`, `examArchives[]`
- `contentPhase`: `default` | `sample` | `planned`
- `samples[]` — enough for tutor demos (Lebanese + SAT + one GCC + one IB)

Terminology helpers (`terminologyFor`) map Derivative / Limits / Domain labels per curriculum (EN + AR).

## CurriculumSwitcher

Visible in the site header (mobile-friendly). On change:

1. Updates React context
2. Writes `localStorage` + cookie
3. If the user is on `/exams`, replaces `?track=` with the curriculum’s primary exam track (`brevet` / `sat` / …)

Auth store has no settings profile field yet — persistence is cookie/localStorage only. Adding `preferredCurriculumId` on `AuthUser` is a later optional enhancement.

## Pedagogical tutor API

```http
POST /api/ai/pedagogical-tutor
Content-Type: application/json
```

**Auth:** same as `/api/solve-math` (session + AI tier / staff).

**Body:**

```json
{
  "text": "Study lim …",
  "latex": "\\lim\\limits_{x \\to +\\infty} \\frac{2x^{2}+1}{x^{2}-4}",
  "imageBase64": "(optional)",
  "mimeType": "image/jpeg",
  "mode": "direct | socratic",
  "curriculumId": "lebanese | sat | …",
  "language": "ar | en",
  "revealAnswer": false
}
```

**Response (structured):**

- `curriculumObjective`
- `prerequisiteConcept`
- `steps[]` — `{ title, justification, latex? }`
- `finalAnswer` + `finalAnswerLatex` (highlighted; withheld in Socratic until `revealAnswer`)
- `hints[]` — progressive levels for Socratic (no full answer)
- `source`: `gemini` | `openai` | `demo`
- `voiceHook` — documents `POST /api/voice-math` (Whisper when `OPENAI_API_KEY` set)
- `imageStatus`: `used` | `stub` | `none` (Gemini Vision when `GEMINI_API_KEY` set; otherwise base64 accepted with stub)

KaTeX / Lebanese equation rules are enforced via `formatLebaneseEquation` (vertical `\frac{a}{b}`, no slash fractions). The tutor system prompt also mandates Word Insert Equation / KaTeX formatting: stacked fractions, true superscripts, full radicals, and limits/integrals under their symbols.

## Reused engines

- Gemini / OpenAI helpers: `src/lib/solver/llm.ts` (`geminiApiKey`, `openaiSolverKey`)
- Lebanese pedagogy system prompt: `src/lib/pedagogy/lebanese.ts`
- Math format: `src/lib/math/lebaneseEquationFormat.ts`
- Voice: existing `/api/voice-math` (document-only hook from tutor responses)

## Phased content plan

| Phase | Scope |
| --- | --- |
| **Now** | Schema, switcher, tutor API, Lebanese default + SAT papers + GCC/IB samples |
| **Next** | Expand GCC Qudurat/Tahsili/EmSAT item banks; IB AA HL paper templates |
| **Later** | Cambridge IGCSE/A-Level past-paper metadata; AP FRQ sets; ACT full mirror |
| **Optional** | Persist `preferredCurriculumId` on authenticated user profile |

## How to test

1. Open https://mathmentor-munzer.netlify.app (or local `npm run dev`)
2. Header → **Curriculum** dropdown → switch Lebanese ↔ SAT ↔ Saudi/GCC ↔ IB
3. Visit `/exams` — track chips follow Lebanese/SAT; phased curricula show a note
4. Visit `/math-solver` — terminology banner + **Pedagogical tutor** panel
5. Sign in (AI tier / staff) → POST Direct then Socratic for a Lebanese limit and an SAT linear equation
6. Without API keys, responses still return structured **demo** JSON

## Env keys

| Key | Role |
| --- | --- |
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | Tutor + Vision + solver |
| `OPENAI_API_KEY` | Tutor fallback + Whisper on `/api/voice-math` |
| `GEMINI_MODEL` / `OPENAI_MODEL` | Optional pins |

## Branding check

All new copy uses **Prof. Munzer Haddara / الأستاذ منذر حداره** only.

## Exams hub (Task 3)

See **`docs/EXAMS_BAREME.md`**: curriculum-filtered `/exams` cards, official Barème beside questions, phased GCC/IB/Cambridge/AP stubs. Lebanese clears `?track=` so all Brevet+Terminale demos show; SAT uses `?track=sat`; others use `?curriculum=<id>`.
