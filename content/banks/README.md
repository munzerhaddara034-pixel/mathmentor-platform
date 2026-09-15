# Topic banks — Lebanese certificate

Certificate practice is split **by topic**, not by dumping a whole session PDF into one quiz.

Four certificate branches live in `content/banks/certificates.json`. The practice hub lists every branch; live JSON files overlay the slots. Remaining LS / SE / GS banks are for a sibling agent — do not photocopy official PDFs.

1. **Brevet / الشهادة المتوسطة** (`brevet/`) — five topic banks seeded
2. **Grade 12 LS** (`g12-ls/`) — Functions (Problem IV) is live
3. **Grade 12 SE** (`g12-se/`) — slots listed, banks later
4. **Grade 12 GS** (`g12-gs/`) — slots listed, banks later

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
  brevet/numbers.json          ← Brevet numbers (now)
  brevet/word_problems.json    ← Brevet word problems (now)
  brevet/coordinate.json       ← Brevet coordinate geometry (now)
  g12-se/…                     ← SE topics (hub lists the branch; banks later)
  g12-gs/…                     ← GS topics (hub lists the branch; banks later)
  certificates.json            ← four-branch paper map for /practice
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

The file also stores `contestTopics` on some banks. The hub’s implemented flags come from `content/banks/certificates.json` overlaid with live `topicBanks` (`certificate` + `topic`).

## How to add the next paper topic (sibling agents)

1. Filter the matching official session PDF for that topic only.
2. Write `content/banks/<folder>/<topic>.json` in the same shape as `brevet/numbers.json` or `g12-ls/functions.json` (≥30 MCQs, easy → medium → hard).
3. Set `certificate` to `Brevet` | `LS` | `SE` | `GS` and `topic` to the catalog slot id.
4. Import the file in `src/lib/topicBanks.ts` and append it to `topicBanks`. The hub lists that branch/card without further page edits.
5. `npm run build`.

Never paste a copyrighted exam page verbatim. Never label generated items as past papers.

Rebuild the Functions extras after editing `scripts/merge-session-style-functions.py`:

```bash
python3 scripts/merge-session-style-functions.py
```

## Student URLs (Functions)

- Contest (16 questions, easy→hard, 25 min): `/practice/take?bank=g12-ls-functions&mode=contest`
- Full bank training (ordered): `/practice/take?bank=g12-ls-functions&mode=free`
- Limits lesson only (first slice + video): `/classroom/grade-12-ch1` and `/practice/take?lessonId=grade-12-ch1`

## Brevet (Grade 9)

See `content/banks/brevet/README.md`. All five Brevet contests are on `/practice`. Rebuild with `python3 scripts/build-brevet-banks.py`.

SE and GS folders are listed on `/practice` as later slots (`content/banks/g12-se/`, `content/banks/g12-gs/`).
