# SAT Math exam simulations

Prof. Munzer Haddara / الأستاذ منذر أحمد حداره. Never Al-Tarah / الطارة.

## Copyright — hard constraint

MathMentor does **not** scrape, OCR, or store College Board SAT practice-test question text or PDFs. We do **not** paste substantial copyrighted exam items into the repo or Netlify.

Instead:

1. **Link** to official College Board free practice PDFs (student opens them on CB’s site).
2. Teach the AI employee the **public Digital SAT Math blueprint** (modules, domains, MCQ + SPR) + optional teacher skill note.
3. Generate **original** similar questions (`generate-similar` / `generate-from-official`).

### Official links (AR + EN)

| Resource | URL |
| --- | --- |
| Practice hub | https://satsuite.collegeboard.org/practice/practice-tests/paper |
| Practice Test #5 Math PDF | https://satsuite.collegeboard.org/media/pdf/sat-practice-test-5-digital.pdf |
| Practice Test #10 Math PDF | https://satsuite.collegeboard.org/media/pdf/sat-practice-test-10-digital.pdf |
| Practice Test #11 Math PDF | https://satsuite.collegeboard.org/media/pdf/sat-practice-test-11-digital.pdf |

Hub UI (`/exams?track=sat`) shows section **«النموذج الرسمي College Board»** with these links (`target=_blank`) and the note:

> الطالب يفتح النموذج الرسمي من College Board؛ المنصة تولّد أسئلة أصلية على نفس النسق دون نسخ الأسئلة.

## Overview

| Kind | What |
| --- | --- |
| **الرسمي College Board (رابط)** | External PDFs only — no CB item text in-app |
| **تدريب المنصة** `sat-math-practice-1` | Platform Algebra + Advanced Math demo |
| **تدريب المنصة** `sat-math-practice-2` | Platform PSD + Geometry/Trig demo |

Track: `sat` · Plan id: `sat` ($45/mo) · Access: same AI gate as `/exams` (`requireAiAccess` — `sat` / `AI_TIER` / `BOTH` / `all`).

### Public Digital SAT Math blueprint (pedagogy)

- 2 modules × ~27 questions (~35 min/module)
- Domains: Algebra · Advanced Math · Problem-Solving & Data · Geometry & Trig
- Response types: MCQ (A–D) + SPR (student-produced)
- Calculator allowed throughout Math

Presets live in `src/lib/exams/officialSatBlueprint.ts` (keyed by practice test **5 / 10 / 11** for pedagogy tagging only).

## Student flow

1. Open `/exams` or `/exams?track=sat`.
2. Optionally open an **official CB PDF** from the hub (new tab).
3. Start platform practice: `/exams/simulator?paper=sat-math-practice-1` (or `-2`).
4. Answer **MCQ** (radio A–D) or **SPR**.
5. Submit → demo barème (or Gemini if keyed) → PDF/HTML report.
6. **Generate similar (على نسقه)** — per question or whole paper.

Math uses KaTeX via `formatLebaneseEquation` / `normalizeToLebaneseLatex` (stacked `\frac`, no slash fractions).

## AI employee command (staff)

On `/exams` (teacher/admin session) and `/studio/voice-solver`: card **«أمر لموظف الذكاء الاصطناعي»**.

### Ready prompt template (AR + EN)

```
أنت موظف الذكاء الاصطناعي لـ MathMentor. ارجع إلى بنية اختبار Digital SAT Math الرسمي (Module، 27 سؤالاً، جبر / رياضيات متقدمة / حل مسائل وبيانات / هندسة ومثلثات، MCQ + SPR). أنشئ N أسئلة أصلية على نسق النموذج الرسمي رقم X، مهارة: …، بتنسيق KaTeX اللبناني/Word، مع خيارات وإجابة وحل مختصر.

You are the MathMentor AI employee. Follow the official Digital SAT Math blueprint (2 modules × ~27 questions; Algebra / Advanced Math / Problem-Solving & Data / Geometry & Trig; MCQ A–D + SPR). Create N ORIGINAL items in the style of College Board Practice Test #X, skill: …, Lebanese KaTeX/Word format, with choices, answer, and short solution. Do NOT copy College Board wording — original only.
```

- **Copy prompt** copies the bilingual text.
- **Run AI employee** copies the prompt and calls `POST /api/exams/generate-from-official`.

### Generate from official API

`POST /api/exams/generate-from-official`

```json
{ "officialTest": 5, "skill": "linear-system", "count": 3, "module": 1, "skillNote": "word problems", "save": true }
```

- `officialTest`: `5` | `10` | `11`
- Auth: session + AI access (or staff)
- Output tagged `source` / `tag`: `official-sat-style-N` — **original** items only
- Uses Gemini / OpenAI when keys exist; otherwise deterministic skill variants from the public blueprint

## Generate similar API (platform papers)

`POST /api/exams/generate-similar`

```json
{ "paperId": "sat-math-practice-1", "questionId": "sat1-q1a", "count": 3, "save": true }
```

- Auth: session + AI access (or staff).
- Deterministic SAT-style variants or LLM when keyed.
- Saved sets appear under **Admin → Exams** (`/admin/exams`).

### How to test without API keys

1. Sign in as teacher / AI-tier account.
2. Open `/exams?track=sat` → confirm official links + (staff) AI employee card.
3. Run **نفّذ التوليد** or open `/exams/simulator?paper=sat-math-practice-1` → Generate similar.
4. Expect original demo items; set listed in `/admin/exams`.

## Files

| Path | Role |
| --- | --- |
| `src/lib/exams/officialSatBlueprint.ts` | CB links + public blueprint + AI prompt builder |
| `src/lib/exams/satPapers.ts` | Platform practice papers (تدريب المنصة) |
| `src/lib/exams/generateSimilar.ts` | `generateSimilarQuestions` + `generateFromOfficial` |
| `src/app/api/exams/generate-similar/route.ts` | Similar API |
| `src/app/api/exams/generate-from-official/route.ts` | Official-style API |
| `src/components/exams/OfficialSatSection.tsx` | Official links UI |
| `src/components/exams/AiEmployeeOfficialCommand.tsx` | Staff AI employee card |
| `src/components/exams/GenerateSimilarPanel.tsx` | Per-paper similar UI |
| `data/exam-generated.json` | Persisted generated sets (local / Blobs) |

## Teacher

- Hub: `/exams?track=sat` — official links + platform practice + AI employee command (staff)
- Studio: `/studio/voice-solver` — same AI employee card (staff)
- Admin: `/admin/exams` — attempts + generated sets
- Subscribe copy for plan `sat` links to the SAT exam hub
