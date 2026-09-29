# Exams hub + official Barème

**Instructor:** Prof. Munzer Haddara / الأستاذ منذر حداره  
**Never:** Al-Tarah / الطارة  
**Site:** https://mathmentor-munzer.netlify.app

## What this ships

1. **Curriculum-wired `/exams` hub** — header `CurriculumSwitcher` + cookie `mm_curriculum` + `ExamCurriculumHooks`.
2. **Official mark distribution (Barème / سلّم التصحيح)** beside each sub-question in the simulator and on the result screen so students can sum points per step.
3. **Phased cards** for GCC / IB / Cambridge / AP (sample or planned) — **no copyrighted full past papers**.

## Curriculum → hub behaviour

| Curriculum (`mm_curriculum`) | Hub URL after switch | Cards |
| --- | --- | --- |
| `lebanese` (default) | `/exams` | Live Brevet + Terminale GS/LS/SE demos (`lebaneseCatalog` pedagogy + `OFFICIAL_PAPERS`) |
| `sat` | `/exams?track=sat` | College Board links + platform SAT practice |
| `saudi-gcc` / `ib` | `/exams?curriculum=…` | Sample topic cards → tutor on `/math-solver` |
| `cambridge` / `ap` | `/exams?curriculum=…` | Planned stubs (phase note) |

Track chips still narrow Lebanese papers (`?track=brevet` …) or pin SAT. Manual chips work until the next curriculum change.

### Key modules

| Piece | Path |
| --- | --- |
| Hub page | `src/app/exams/page.tsx` |
| Curriculum URL sync | `src/components/curriculum/ExamCurriculumHooks.tsx` |
| Hub slice helper | `src/lib/exams/curriculumHub.ts` |
| Barème helpers | `src/lib/exams/bareme.ts` |
| Barème UI | `src/components/exams/BaremeAside.tsx` |
| Simulator | `src/components/exams/ExamSimulator.tsx` |
| Light paywall hook (Task 4 later) | `src/lib/exams/accessHook.ts` (`enforcePaywall: false`) |

## Barème data model

Each `ExamSubQuestion` may carry:

```ts
bareme?: Array<{ id: string; labelEn: string; labelAr: string; marks: number }>;
```

Steps **should sum to** `sub.marks`. Lebanese demo papers (Brevet + Terminale) ship explicit steps (e.g. isolate → exact root). If `bareme` is omitted, `baremeStepsForSub` falls back to one step from `rubric` / full marks (SAT MCQ/SPR).

Grading still awards at **sub** level via `demoGradePaper` / Gemini (`src/lib/exams/grader.ts`). The UI shows official step maxes during the attempt and awarded/max after submit. Async submit uses `SkeletonBlock`.

## How to verify (Lebanese + Barème)

1. Open https://mathmentor-munzer.netlify.app/exams (or local `npm run dev` → `/exams`).
2. In the header, set **Curriculum → Lebanese** (cookie `mm_curriculum=lebanese`). Hub shows Brevet + Terminale cards (not SAT-only).
3. Optional: click track chip **Terminale LS** → `/exams?track=terminale-ls`.
4. Start **Terminale LS — Official simulation**: `/exams/simulator?paper=term-ls-2024-demo`.
5. Confirm each sub shows a **سلّم · Barème** panel with step points (e.g. 1 + 1.5 + 1.5) and a question total sticky on desktop.
6. Answer a few items → **Submit for AI grading** → skeleton → result hero `awarded / totalMax` and per-question Barème with awarded marks.
7. Switch curriculum to **Saudi / GCC** → sample cards + phase note (no fake ministry PDF).
8. Switch to **SAT** → official CB links + platform practice.

## Copyright

- Lebanese items are **original academy demos** aligned to CRDP-style skills — not ministry scan dumps.
- SAT: link out to College Board; platform papers are original (see `docs/SAT_EXAMS.md`).
- GCC / IB / Cambridge / AP: sample prompts + planned stubs only.

## Paywall (deferred)

`EXAM_PAYWALL_HOOK.enforcePaywall` stays `false`. Hub shows a soft subscribe hint. Simulator POST still uses existing AI-access guard (`userHasAiAccess`) — Task 4 will expand gating, not this release.
