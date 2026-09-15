# Topic banks — Lebanese certificate

Certificate practice is split **by topic**, not by dumping a whole session PDF into one quiz.

Four certificate branches are live on `/practice`:

| Code | Arabic | Folder | Banks |
| --- | --- | --- | --- |
| **Brevet** | الشهادة المتوسطة | `brevet/` | numbers, algebra, word_problems, geometry, coordinate |
| **LS** | علوم الحياة | `g12-ls/` | mcq_mixed, space_geometry, probability, functions |
| **SE** | اجتماع واقتصاد | `g12-se/` | mcq_mixed, probability, functions |
| **GS** | العلوم العامة | `g12-gs/` | mcq_mixed, space_geometry, probability, complex, functions |

Official packs on Munzer’s PC (not committed; do not photocopy into Git):

| File | Track |
| --- | --- |
| `LS all sessions.pdf` | Grade 12 Life Sciences |
| `SE_All Sessions.pdf` | Grade 12 Sociology & Economics |
| `GS-All.pdf` | Grade 12 General Science |
| Grade 9 / Brevet contests pack | الشهادة المتوسطة |

Items are academy-original, tagged `generated-in-official-style`, ordered **easy → medium → hard**. They are **not** past papers.

## Typical papers → files

### LS (four problems)

| # | Topic | Bank file | Status |
| --- | --- | --- | --- |
| **I** | Mixed MCQ | `g12-ls/mcq-mixed.json` | **seeded** |
| **II** | Space geometry | `g12-ls/space-geometry.json` | **seeded** |
| **III** | Probability | `g12-ls/probability.json` | **seeded** |
| **IV** | Functions analysis | `g12-ls/functions.json` | **seeded** |

`g12-ls/integration.json` remains a later extra chapter, not one of the four paper slots.

### SE — اجتماع واقتصاد (econ / analysis flavour)

| # | Topic | Bank file | Status |
| --- | --- | --- | --- |
| **I** | Mixed MCQ (logs, finance, stats) | `g12-se/mcq-mixed.json` | **seeded** |
| **II** | Probability & statistics | `g12-se/probability.json` | **seeded** |
| **III** | Functions & economic analysis | `g12-se/functions.json` | **seeded** |

### GS — العلوم العامة

| # | Topic | Bank file | Status |
| --- | --- | --- | --- |
| **I** | Mixed MCQ | `g12-gs/mcq-mixed.json` | **seeded** |
| **II** | Space geometry | `g12-gs/space-geometry.json` | **seeded** |
| **III** | Probability | `g12-gs/probability.json` | **seeded** |
| **IV** | Complex numbers | `g12-gs/complex.json` | **seeded** |
| **V** | Functions analysis | `g12-gs/functions.json` | **seeded** |

### Brevet

See `brevet/README.md`. All five topic banks are seeded.

## Folder layout

```
content/banks/
  g12-ls/mcq-mixed.json
  g12-ls/space-geometry.json
  g12-ls/probability.json
  g12-ls/functions.json
  g12-ls/integration.json          ← extra LS chapter later
  g12-se/mcq-mixed.json
  g12-se/probability.json
  g12-se/functions.json
  g12-gs/mcq-mixed.json
  g12-gs/space-geometry.json
  g12-gs/probability.json
  g12-gs/complex.json
  g12-gs/functions.json
  brevet/numbers.json
  brevet/algebra.json
  brevet/word_problems.json
  brevet/geometry.json
  brevet/coordinate.json
```

## JSON shape

Each question:

- `slice` — subtopic inside the file
- `difficulty` — `easy` | `medium` | `hard`
- `source.kind` — `generated-in-official-style` (or later `session-extract`)
- `source.models` — e.g. `["LS all sessions.pdf"]`
- `stem`, `latex`, `choices`, `answerIndex`, `answer`, `solutionSketch`

Keep the array **easy → medium → hard**. Within a band, keep pedagogical slice order.

Each file also stores `contestTopics` for that certificate, with `implemented: true` on live banks.

## Rebuild

```bash
python3 scripts/build-g12-banks.py      # LS remaining + SE + GS
python3 scripts/build-brevet-banks.py   # Brevet
python3 scripts/merge-session-style-functions.py  # LS Functions extras
```

Register new files in `src/lib/topicBanks.ts` (`import` + `topicBanks` array + `CERTIFICATE_ORDER`). Then `npm run build`.

## Student URLs

Hub: `/practice` (grouped Brevet / LS / SE / GS).

Contest (16 questions, easy→hard): `/practice/take?bank=<id>&mode=contest`  
Full-bank training: `/practice/take?bank=<id>&mode=free`

| Bank id | Contest |
| --- | --- |
| `g12-ls-mcq-mixed` | LS mixed MCQ |
| `g12-ls-space-geometry` | LS space geometry |
| `g12-ls-probability` | LS probability |
| `g12-ls-functions` | LS functions |
| `g12-se-mcq-mixed` | SE mixed MCQ |
| `g12-se-probability` | SE probability |
| `g12-se-functions` | SE functions |
| `g12-gs-mcq-mixed` | GS mixed MCQ |
| `g12-gs-space-geometry` | GS space geometry |
| `g12-gs-probability` | GS probability |
| `g12-gs-complex` | GS complex numbers |
| `g12-gs-functions` | GS functions |
| `brevet-numbers` | Brevet numbers |
| `brevet-algebra` | Brevet algebra |
| `brevet-word-problems` | Brevet word problems |
| `brevet-geometry` | Brevet geometry |
| `brevet-coordinate` | Brevet coordinate |
