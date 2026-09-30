# Voice dictation → Pedagogical tutor → Board

**Prof. Munzer Haddara / الأستاذ منذر حداره** only. Never Al-Tarah / الطارة.

End-to-end pipeline for teacher dictation that lands justified KaTeX on the shared board / studio canvas.

## Flow

```
Mic (or Demo transcript)
    → POST /api/voice-math
         · Whisper whisper-1 when OPENAI_API_KEY works
         · polite demo/stub transcript when Whisper is missing or has no credits
         · Speech-to-LaTeX + Lebanese formatting cleaning layer
    → POST /api/ai/pedagogical-tutor  (mode = Direct)
         · curriculumId from CurriculumSwitcher (cookie / localStorage)
         · Gemini preferred, OpenAI backup, demo tutor if both unavailable
    → Board
         · Live classroom: VoiceToBoardPanel → onEquation / LiveKit whiteboard.equation
           (+ HTTP sync via existing whiteboard PUT when the room uses it)
         · Studio: /studio/voice-solver canvas + Pedagogical tutor KaTeX steps panel
```

Surfaces:

| Surface | Component |
| --- | --- |
| `/studio/voice-solver` (also `/teacher/voice-math`) | `VoiceMathStudio` |
| Live room teacher side panel | `VoiceToBoardPanel` |

Both use skeleton loaders, try/catch, and typed payloads (no `any`). Mobile-first layout via `mm-mobile-stack`.

## OpenAI-optional / Whisper without credits

OpenAI billing may be postponed. The path stays fully wired:

| Situation | Behavior |
| --- | --- |
| `OPENAI_API_KEY` valid + credits | Real Whisper STT (`whisper-1`) |
| Key missing | Demo dictation + bilingual polite notice (practice mode) |
| Key present but `insufficient_quota` / 429 / billing | Same demo transcript + polite student/teacher notice — **never** raw OpenAI JSON |
| Explicit **Demo transcript** button | Forces stub STT; no Whisper call |

Gemini is **not** required for STT and must not block the pipeline. Optional future Gemini STT can be added later; prioritize Whisper + demo.

The pedagogical tutor itself already falls back Gemini → OpenAI → curriculum-aligned demo (see [GLOBAL_CURRICULUM.md](./GLOBAL_CURRICULUM.md) / `runPedagogicalTutor`).

## How to test without Whisper

1. Sign in as teacher (`teacher@mathmentor.local` — [AUTH.md](./AUTH.md)).
2. Set curriculum in the nav **Curriculum** switcher (persists to cookie).
3. Open **`/studio/voice-solver`**.
4. Tap **تجربة بدون ميكروفون / Demo transcript**.
5. Expect: STT warning (practice mode) → LaTeX steps → Direct-mode tutor panel with KaTeX + boxed final answer on the studio board.
6. In a live classroom as teacher: **تجربة إلى السبورة / Demo to board** — equations appear on the shared whiteboard for students.

No `OPENAI_API_KEY` and no mic permission are required for the demo path.

## When Whisper has no credits

Recording + **حلّ التسجيل / Solve recording** still succeeds:

1. Whisper request fails with quota/billing.
2. Server substitutes a demo transcript and sets a polite bilingual `warning` / `warningAr`.
3. Speech-to-LaTeX and pedagogical tutor continue so the board fills.
4. UI shows the notice; students/teachers are not shown raw `insufficient_quota` payloads.

## Related docs

- [VOICE_MATH.md](./VOICE_MATH.md) — STT, Speech-to-LaTeX, video
- [MATH_FORMATTING.md](./MATH_FORMATTING.md) — Lebanese / Word Equation LaTeX
- [PEDAGOGY.md](./PEDAGOGY.md) — official explanation sequence
- [LIVEKIT.md](./LIVEKIT.md) — classroom data channel / whiteboard
