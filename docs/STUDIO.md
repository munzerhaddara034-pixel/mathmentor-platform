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
| http://localhost:3000/lessons/interactive | Official exam player — `f(x)=(x-1)e^x`, EN default + FR toggle |
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
- **Phone**: **video on top**, canvas below — so the teacher is visible while listening; scroll for the board.
- The lesson stage stays `dir="ltr"` so graphs and KaTeX are not mirrored. Site chrome (nav) can remain Arabic RTL.
- Canvas pan / zoom / hover does **not** pause video audio or playback.

## Time-synced math canvas

`video.ontimeupdate` / `seeked` (and the silent RAF clock when there is no clip) set `currentTime`. The canvas reads timeline events and:

1. **Fade-in** KaTeX when `currentTime` reaches `show_equation` / `fade_equation`.
2. **Plots immediately** on `render_graph` (Function Plot SVG; Desmos if `NEXT_PUBLIC_DESMOS_API_KEY` is set).
3. Highlights **roots, extrema, asymptotes** from the event payload.

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

`leb-term-func-01` / `/lessons/interactive` seeds a fade at 40s, `render_graph` at 42.5s (roots / extrema / asymptotes), then `highlight_point` at 45s. Wheel or pinch to zoom, drag to pan, hover for `(x, f(x))` — playback continues. If the attached clip is shorter than the lesson (local demo mp4), it **loops** after handing the clock to RAF so audio stays up while you inspect the graph.

## Seeded lesson

`leb-term-func-01` is preloaded in `/studio/script`. Scene 1–2 use `renderMath` (KaTeX). Scene 3 uses `plotFunction` with `(x-1)*exp(x)` on `[-3, 2]` (Desmos, or SVG if no key).

The interactive demo wraps the same content in the four pedagogical phases (intro / rule+graph / product-rule example / common mistake).

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

1. **introduction** (~30s) — definition + Lebanese exam scope
2. **rule_graph** (~60s) — rule + mandatory `render_graph` / plot (avatar paused)
3. **real_example** (~120s) — worked substitution + `show_step` (`step_en` / `step_fr` / `math_latex`)
4. **common_mistake** (~30s)

Template mode includes French on every narration. OpenAI is used only when `OPENAI_API_KEY` or `LLM_API_KEY` is set.

## Integrations

- **Desmos** (`src/lib/studio/desmos.ts`): loads `https://www.desmos.com/api/v1.8/calculator.js?apiKey=…`. Desmos **requires** a free API key from [their API docs](https://www.desmos.com/api/v1.8/docs/index.html). Set `NEXT_PUBLIC_DESMOS_API_KEY`. If the key is missing or the script fails, the existing SVG function plotter is used (still plots `(x-1)*exp(x)`).
- **KaTeX** npm package (`katex.renderToString`) on the canvas — no extra client global needed. Optional CDN: `https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js` + matching CSS.
- **HeyGen**: live `POST https://api.heygen.com/v2/video/generate` only when `HEYGEN_API_KEY` is set. Without a key: deterministic mock job + local `/studio/demo-avatar.mp4`. See [HEYGEN.md](./HEYGEN.md).
- **Function Plot**: SVG engine in `src/lib/studio/functionPlot.ts` always available for canvas sync. Desmos remains optional.
- **GeoGebra**: still a typed future hook (`src/lib/studio/geogebra.ts`), not required.
