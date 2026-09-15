# Interactive avatar & smart board (استوديو الدروس الشارحة)

Demo for **مشغل الدروس الشارحة والسبورة الذكية** — Professor Munzer Haddara / الأستاذ منذر حدارة.

## Run locally

```bash
npm install
npm run dev
```

Open:

| Route | What it is |
| --- | --- |
| http://localhost:3000/lessons/interactive | Exponential Functions demo — avatar + synced canvas |
| http://localhost:3000/studio/player?lesson=complex | Complex Numbers sample |
| http://localhost:3000/studio/script | Teacher script generator |
| `POST /api/studio/script` | `{ topic, track, language, grade }` → LessonTimeline JSON |

No API keys are required for the demo. `HEYGEN_API_KEY` and `OPENAI_API_KEY` are optional (see `.env.example`).

## Pedagogical contract

Every generated (and demo) timeline has **four phases**:

1. **introduction** (~30s) — concept definition + Lebanese exam scope (Brevet / LS / SE / GS / LH)
2. **rule_graph** (~60s) — state the rule + mandatory canvas trigger `render_graph` (avatar **paused** / freeze while the board draws)
3. **real_example** (~120s) — full worked problem with substitution + mandatory `show_step` actions
4. **common_mistake** (~30s) — typical official-exam error

During graphing, the canvas highlights **Roots**, **Asymptotes**, and **Extrema** when they apply.

## Timeline schema

`at` on each canvas action is **seconds from the start of that segment** (not absolute time). The player seeks canvas state from `currentTime`.

```json
{
  "id": "ls-exponential-functions",
  "title": { "ar": "…", "en": "…" },
  "language": "ar",
  "durationSec": 240,
  "segments": [
    {
      "id": "intro",
      "start": 0,
      "end": 30,
      "phase": "introduction",
      "narration": { "ar": "…", "en": "…" },
      "avatar": { "state": "speaking" },
      "canvas": {
        "actions": [
          { "at": 5, "type": "show_equation", "payload": { "latex": "f(x)=a^{x}", "caption": { "ar": "تعريف", "en": "Definition" } } }
        ]
      }
    }
  ]
}
```

Canvas `type` values: `show_equation` | `render_graph` | `highlight_point` | `show_step` | `clear`.

`render_graph` payload:

- `{ "kind": "function", "fn": "exp(x)", "xDomain": [-2, 2], "yDomain": [-1, 8] }`
- `{ "kind": "argand", "points": [{ "x": 3, "y": -4, "label": { "ar": "3−4i", "en": "3 − 4i" } }] }`

`highlight_point` payload: `{ "kind": "root" | "asymptote" | "extrema" | "point", "x", "y", "axis": "x"|"y", "value", "label" }`.

## Integrations

- **HeyGen** (`src/lib/studio/heygen.ts`): `createAvatarTalkingVideo` / `fetchAvatarTalkingVideo`. If `HEYGEN_API_KEY` is missing, returns a **demo job** (Munzer still `public/teachers/munzer.jpg`) and never calls the network.
- **KaTeX** for equations on the canvas (MathJax remains on existing quiz pages).
- **Function plotter** (`src/lib/studio/functionPlot.ts`): lightweight SVG engine (function-plot compatible `fn` in `x`). Optional future adapters:
  - npm `function-plot` (d3)
  - **GeoGebra** typed hook in `src/lib/studio/geogebra.ts` — no credentials required
- **LLM**: if `OPENAI_API_KEY` or `LLM_API_KEY` is set, the script API uses a strict system prompt; otherwise a deterministic template (Exponential Functions, Complex Numbers, quadratics, or a generic worked example). `ensurePedagogy()` always injects missing `render_graph` / `show_step` so the four-phase contract cannot be dropped.

## Player controls

Play / pause / restart, speed (0.75×–1.5×), seek bar, **AR | EN** toggle for on-screen text (English default on the sample lesson, matching prior classroom videos). RTL layout keeps the **avatar on the right** (top on small screens) and the **math canvas on the left** (bottom on small screens).

Generated scripts open via **Open in Interactive Player** (`/studio/player?src=session`).
