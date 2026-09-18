# Voice-to-Math Automated Solver

**الموظف الذكي للشرح الصوتي** — MathMentor · أكاديمية منذر حداره.

Instructor: **Prof. Munzer Haddara / الأستاذ منذر حداره**. Never Al-Tarah / الطارة.

Teachers record an Arabic or English math explanation. The pipeline:

1. **Speech-to-text** — OpenAI Whisper (`whisper-1`) when `OPENAI_API_KEY` is set.
2. **Speech-to-LaTeX** — Gemini 1.5 Pro (`GEMINI_API_KEY`) preferred, else GPT-4o, else the local phrase map + Lebanese demo solver.
3. **Live Math Canvas** — KaTeX steps in the official sequence from [`src/lib/pedagogy/lebanese.ts`](../src/lib/pedagogy/lebanese.ts): Key Idea → Domain \(D_f\) → Limits/Asymptotes → Derivative/Variation table → Points/Graph → Boxed answers → Common pitfalls.
4. **Generate video with teacher voice** — attaches the recording as `timeline.media.audioUrl` (canvas follows the audio clock). If `HEYGEN_API_KEY` is set, also queues the existing HeyGen avatar generator with the avatar script; the recording remains available as narration when a custom HeyGen voice is configured.

Jobs and audio blobs are stored through the existing `dataDir` helpers (local `data/` or Netlify Blobs on deploy). Session cookies and the pedagogy engine are unchanged.

## Try the demo (no API keys)

```bash
npm install
npm run dev
```

1. Sign in as the teacher: `teacher@mathmentor.local` / `demo-teacher` (see [AUTH.md](./AUTH.md)).
2. Open **`/studio/voice-solver`** (also `/teacher/voice-math`, or the gold microphone on `/dashboard`).
3. Tap **تجربة بدون ميكروفون / Demo transcript** (sample: «إكس مربع»، «نهاية عند الزائد إنفينيتي»، «ديريفاتيف»).
4. The board fills immediately with Lebanese-structured LaTeX (`renderMath`, `variationTable`, `plotFunction`, `boxAnswer`, `exam_tip`).
5. Tap **توليد فيديو بصوت الأستاذ / Generate video with teacher voice**. Demo mode plays equal-time canvas chunks (or Whisper timestamps when a real recording + key exist). Open `/lessons/voice-solver?id=…` as a student-linked player.

Optional: allow the microphone, tap **تسجيل الشرح الصوتي**, stop, preview, then **حلّ التسجيل**. Without `OPENAI_API_KEY` the audio is still stored and the sample/demo parser continues so `npm run build` and local demos work.

## Env vars

| Variable | Used for |
| --- | --- |
| `OPENAI_API_KEY` | Whisper `whisper-1` transcription; GPT-4o speech-to-LaTeX fallback |
| `OPENAI_VOICE_MODEL` | Optional chat model (default `gpt-4o`) |
| `GEMINI_API_KEY` | Preferred speech-to-LaTeX (Gemini 1.5 Pro, then flash) |
| `GEMINI_VOICE_MODEL` | Optional pin (tried first) |
| `HEYGEN_API_KEY` | Optional talking-avatar generate; empty = demo player + teacher audio |
| `HEYGEN_VOICE_ID` / `_AR` / `_EN` / `_FR` | Existing HeyGen voices ([HEYGEN.md](./HEYGEN.md)) |

Copy from [`.env.example`](../.env.example). Never commit real secrets.

## Routes

| Surface | Auth |
| --- | --- |
| `/studio/voice-solver` · `/teacher/voice-math` | **teacher/admin** |
| `/dashboard` microphone CTA | staff |
| `/lessons/interactive?teacher=1` link | staff tooling |
| `POST /api/voice-math` | staff; `multipart` (`audio`, `demo`, `transcript`, `language`, `track`, `durationSec`) or JSON demo |
| `GET /api/voice-math` | own jobs (staff: all) |
| `GET /api/voice-math/[id]` | owner, staff, or `studentEnabled` |
| `GET /api/voice-math/[id]/audio` | same; recorded webm/wav |
| `POST /api/voice-math/[id]/video` | staff; HeyGen or demo + teacher audio |
| `/lessons/voice-solver?id=` | subscribed student can **view** a linked explanation |

Spoken → LaTeX examples (demo mapper and LLM prompt):

- «إكس مربع» / “x squared” → `$x^2$`
- «نهاية عند الزائد إنفينيتي» → `$\lim_{x \to +\infty}$`
- «ديريفاتيف» → `$f'(x)$`
