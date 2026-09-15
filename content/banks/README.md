# Topic banks — Lebanese certificate

Certificate practice is split **by topic**, not by dumping a whole session PDF into one quiz.

Two certificate levels:

1. **Grade 12 LS** (`g12-ls/`) — Functions (Problem IV) is live
2. **Brevet / الشهادة المتوسطة** (`brevet/`) — geometry + algebra seeded

Official packs on Munzer’s PC (not committed; do not photocopy into Git):

| File | Track |
| --- | --- |
| `LS all sessions.pdf` | Grade 12 Life Sciences |
| `SE_All Sessions.pdf` | Grade 12 Sociology & Economics |
| `GS-All.pdf` | Grade 12 General Science |
| Grade 9 / Brevet contests pack | الشهادة المتوسطة |

## Typical LS paper (four topics)

Lebanese Grade 12 LS math sessions are usually **four problems**:

| # | Topic | Typical weight | Bank file |
| --- | --- | --- | --- |
| **I** | Mixed MCQ | ~2.5 pts | not a file yet |
| **II** | Space geometry | ~5.5 pts | `g12-ls/space-geometry.json` (later) |
| **III** | Probability | ~4 pts | `g12-ls/probability.json` (later) |
| **IV** | Functions analysis | ~8 pts | **`g12-ls/functions.json` (this PR)** |

Problem IV (Functions) is the only bank implemented now. Later LS files follow the same paper split, not “vectors then integration” as the first cut.

Style reference for Functions: filtered excerpts from `LS all sessions.pdf` (limits at 0 / +∞, vertical–horizontal–oblique asymptotes, table of variations, inverse on an interval, tangent, unique root with a numerical sandwich). New stems use **original** functions in that wording. They are tagged `generated-in-official-style` and must **not** be presented as past papers.

## Folder layout

```
content/banks/
  g12-ls/functions.json        ← IV · Functions (now)
  g12-ls/space-geometry.json   ← II · later
  g12-ls/probability.json      ← III · later
  g12-ls/integration.json      ← extra LS chapter later (not one of the four paper slots)
  brevet/geometry.json         ← Brevet geometry (now)
  brevet/algebra.json          ← Brevet algebra (now)
  brevet/numbers.json          ← later
  brevet/word_problems.json    ← later
  brevet/coordinate.json       ← later
  g12-se/…                     ← SE topics later
  g12-gs/…                     ← GS topics later
```

One JSON file = one topic contest. Functions slices (easy → hard within the file):

1. Limits (classroom video + notes: `/classroom/grade-12-ch1`)
2. Continuity
3. Derivatives
4. Table of variations
5. Asymptotes
6. Inverse functions

## JSON shape

Each question:

- `slice` — subtopic inside the file (`limits`, `continuity`, `derivatives`, `variation`, `asymptotes`, `inverse`)
- `difficulty` — `easy` | `medium` | `hard`
- `source.kind` — `generated-in-official-style` or later `session-extract`
- `source.models` — e.g. `["LS all sessions.pdf"]`
- `stem`, `latex`, `choices`, `answerIndex`, `answer`, `solutionSketch`

Keep the array **easy → medium → hard**. Within a band, keep pedagogical slice order (Limits first).

The file also stores `contestTopics`: the official paper split for that certificate (LS four problems, or Brevet’s five topic banks), with `implemented: true` only on live files.

## How to add the next LS paper topic (example: space geometry)

1. Filter the matching official session PDF for that topic only (space geometry, not Functions).
2. Copy `functions.json` to `content/banks/g12-ls/space-geometry.json`.
3. Change `id` to `g12-ls-space-geometry`, `topic` / titles, `sourceModels`, and `slices`.
4. Replace `questions` with new stems in official-session style. Tag genuine extracts `session-extract`; keep academy-original siblings `generated-in-official-style`. Never paste a copyrighted exam page verbatim. Never label generated items as past papers.
5. Register the file in `src/lib/topicBanks.ts` (`import` + `topicBanks` array). Set that row’s `implemented: true` in `contestTopics` on the Functions file (or a shared LS paper index) when the bank is live.
6. `npm run build`.

Same steps for `probability.json`. Integration is a later chapter bank, not one of the four typical paper slots.

Rebuild the Functions extras after editing `scripts/merge-session-style-functions.py`:

```bash
python3 scripts/merge-session-style-functions.py
```

## Student URLs (Functions)

- Contest (16 questions, easy→hard, 25 min): `/practice/take?bank=g12-ls-functions&mode=contest`
- Full bank training (ordered): `/practice/take?bank=g12-ls-functions&mode=free`
- Limits lesson only (first slice + video): `/classroom/grade-12-ch1` and `/practice/take?lessonId=grade-12-ch1`

## Brevet (Grade 9)

See `content/banks/brevet/README.md`. Geometry and algebra contests are on `/practice`. Rebuild with `python3 scripts/build-brevet-banks.py`.
