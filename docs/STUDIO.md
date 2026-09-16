# Interactive avatar & explanation studio

Demo for **مشغل الدروس الشارحة والسبورة الذكية** — Prof. Munzer Haddara / الأستاذ منذر حداره.

## Run locally

```bash
npm install
npm run dev
# or, as in some local previews:
npm run dev -- -p 3001
```

Open:

| Route | What it is |
| --- | --- |
| http://127.0.0.1:3001/studio/script | Script editor (seeded `leb-term-func-01` JSON) |
| http://localhost:3000/admin/video-generator | Teacher HeyGen generator (script, notes, math, voice, speed) |
| http://localhost:3000/lessons/interactive | Official exam player (login required) |
| http://localhost:3000/login | Sign in (demo accounts: [AUTH.md](./AUTH.md)) |
| http://localhost:3000/redeem | Promo/card unlock (signed in) |
| http://localhost:3000/studio/player?lesson=leb-term-func-01 | Exact 3-scene seed |
| http://localhost:3000/studio/player?job=… | Sync player for a HeyGen job |
| `POST /api/studio/script` | `{ topic, track, language, grade }` → four-phase EN+FR JSON |
| `POST /api/heygen/generate` | Create HeyGen (or demo) video job |

No secrets are required. Desmos and OpenAI/HeyGen keys are optional (see `.env.example`).

## Daily workflow

1. Write the script in `/studio/script`.
2. Generate the talking-avatar clip in `/admin/video-generator`.
3. Wait for webhook or `GET /api/heygen/status?jobId=…`.
4. Students watch the **sync player** (`/lessons/interactive`): math canvas on the **left**, HeyGen video on the **right** (on phones the video is on top). Clock = `video.currentTime`.

Full payload, env vars, and webhook notes: [HEYGEN.md](./HEYGEN.md).

## Language engine

- Lesson default is **English** (Lebanese English-section: Brevet / Terminale LS, GS, SE).
- Prominent control: **🌐 Switch to French / Passer en Français** (and the reverse).
- Toggle updates narration, subtitles, KaTeX step text, and UI labels **without reloading** and without resetting `currentTime` / play state.
- Site chrome (nav) may stay Arabic/RTL; the lesson stage is LTR EN/FR.

## Dual view

- **Desktop (≥900px)**: **left = interactive math canvas**, **right = HeyGen / avatar video**.
- **Phone**: **video on top**, canvas below — so the teacher is visible while listening; tap **Board on top** to swap.
- Touch targets are at least 44px; KaTeX on the board scrolls horizontally on small screens.
- The lesson stage stays `dir="ltr"` so graphs and KaTeX are not mirrored. Site chrome (nav) can remain Arabic RTL.
- Canvas pan / zoom / hover does **not** pause video audio or playback (a quiz checkpoint is the only auto-pause).
- **Chapters** sit under the video (`leb-term-func-01`: intro, limits, derivative, quiz, graph, example, mistake). Tap a chapter to seek video + canvas together.
- **Fullscreen** buttons open the board or the video. On phones: video top, canvas bottom, 44px controls, one-tap swap.
- **PWA**: `manifest.webmanifest` + `sw.js` so students can **Add to Home Screen**. Name: MathMentor · أكاديمية منذر حداره. Icons from `/brand/`.

## Time-synced math canvas

The video element is the clock whenever the playhead is inside the clip (`video.currentTime`, with `seeked` / `play` / `pause` / `ratechange` plus **animation-frame** polling). `timeupdate` is ignored while that RAF clock is active so the canvas does not double-tick. Seeking **recomputes** the board from an empty state (`canvasStateAt`) so going backward or forward is idempotent. After a short placeholder clip ends, a RAF lesson clock continues so a 6-minute script can outlive an 8-second demo file — the clip may loop visually, but it no longer overwrites the canvas. Pan/zoom never pauses audio.

1. **Fade-in** KaTeX when `currentTime` reaches `show_equation` / `fade_equation`.
2. **Plots immediately** on `render_graph` (Function Plot SVG; Desmos if `NEXT_PUBLIC_DESMOS_API_KEY` is set).
3. Highlights **roots, extrema, asymptotes** from the event payload.
4. **`quiz_mcq`** auto-pauses the video, shows an MCQ overlay, and resumes only after a correct check **or** after **Show solution** (which unlocks **Continue**). Wrong answers stay retryable.

Flat event fields are lifted into `payload` (backward compatible with `{ at, type, payload }`). Absolute-time events may live on `timeline.events`:

```json
{
  "at": 42.5,
  "type": "render_graph",
  "latex": "f(x)=(x-1)e^x",
  "expression": "(x-1)*exp(x)",
  "domain": [-3, 2],
  "highlights": {
    "roots": [[1, 0]],
    "extrema": [[0, -1]],
    "asymptotes": [{ "y": 0 }]
  }
}
```

`leb-term-func-01` / `/lessons/interactive` is a **full Terminale LS/GS/SE study** of `f(x)=(x-1)e^x` (~6 min): domain, limits rewritten as a quotient, product-rule algebra, in-video MCQ at **2:18** (`f'(x)=x e^x`), table of variation, timed graph (root / min / asymptote around 2:30), official exercise `f(x)=m` and `f(x)=−1/2` with four graded steps, then the exam trap `(−∞)×0` and `f'=e^x`. EN and FR are written as parallel papers, not a calque. Wheel or pinch to zoom — playback continues. Short demo clips loop after they hand the clock to RAF.

## Seeded lesson

`leb-term-func-01` is preloaded in `/studio/script` as the **four-phase timeline** (not a three-line slogan). `/studio/player?lesson=leb-term-func-01` still plays the compact scene document (same math, shorter audio).

A **Teacher Quality Checklist** sits on `/studio/script` and `/admin/video-generator`: exam alignment, step completeness, graph necessity, trap+correction, monetization ready. Instructor: **Prof. Munzer Haddara** / **الأستاذ منذر حداره**.

## Teacher timeline editor

Open `/lessons/interactive?teacher=1` **while signed in as teacher or admin** (`teacher@mathmentor.local` / `demo-teacher`). The mini-panel edits absolute `timeline.events`. **Apply live** updates the player without a reload. **Save** writes `sessionStorage` and `POST /api/studio/events`. Auth, single-session, noindex, and watermarks: [AUTH.md](./AUTH.md).

## In-video quiz

A `quiz_mcq` event pauses playback when `currentTime` reaches `at`. Skipping past an unanswered quiz is clamped. Resume after **Check answer** (correct) or **Show solution** then **Continue**. Seeded in `leb-term-func-01` at 138s.

## Timeline schema

The player accepts **both**:

1. Scene documents (`lessonId`, `defaultLanguage`, `title.en/fr`, `scenes[].audio.en/fr`, `canvas.type` = `renderMath` | `plotFunction`)
2. The previous `LessonTimeline` (`segments`, `narration.en` + optional `fr` / `ar`)

Step payloads may use:

```json
{
  "step_en": "Calculate the derivative f'(x) using the product rule.",
  "step_fr": "Calculez la dérivée f'(x) en utilisant la règle du produit.",
  "math_latex": "f'(x) = x e^x"
}
```

`at` on canvas actions is seconds from the **segment** start.

## Pedagogical contract (script generator)

`POST /api/studio/script` always returns four phases:

1. **introduction** (~50s) — certificate scope + domain with justification
2. **rule_graph** (~100s) — proof sketch + mandatory `render_graph` (avatar paused)
3. **real_example** (~160s) — official exercise with **≥3** `show_step` lines (`step_en` / `step_fr` / `math_latex`)
4. **common_mistake** (~40s) — wrong reasoning named, then the correction

Template mode includes French on every narration at the same rigor. OpenAI is used only when `OPENAI_API_KEY` or `LLM_API_KEY` is set.

## Integrations

- **Desmos** (`src/lib/studio/desmos.ts`): loads `https://www.desmos.com/api/v1.8/calculator.js?apiKey=…`. Desmos **requires** a free API key from [their API docs](https://www.desmos.com/api/v1.8/docs/index.html). Set `NEXT_PUBLIC_DESMOS_API_KEY`. If the key is missing or the script fails, the existing SVG function plotter is used (still plots `(x-1)*exp(x)`).
- **KaTeX** npm package (`katex.renderToString`) on the canvas — no extra client global needed. Optional CDN: `https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js` + matching CSS.
- **HeyGen**: live `POST https://api.heygen.com/v2/video/generate` only when `HEYGEN_API_KEY` is set. Without a key: deterministic mock job + local `/studio/demo-avatar.mp4`. See [HEYGEN.md](./HEYGEN.md).
- **Function Plot**: SVG engine in `src/lib/studio/functionPlot.ts` always available for canvas sync. Desmos remains optional.
- **GeoGebra**: still a typed future hook (`src/lib/studio/geogebra.ts`), not required.
