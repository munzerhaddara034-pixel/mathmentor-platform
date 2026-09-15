# Topic banks — Lebanese certificate

Certificate practice is split **by topic**, not by dumping a whole session PDF into one quiz.

Official packs on Munzer’s PC (not committed; do not photocopy into Git):

| File | Track |
| --- | --- |
| `LS all sessions.pdf` | Grade 12 Life Sciences |
| `SE_All Sessions.pdf` | Grade 12 Sociology & Economics |
| `GS-All.pdf` | Grade 12 General Science |

## Folder layout

```
content/banks/
  g12-ls/functions.json     ← pilot (this PR)
  g12-ls/vectors.json       ← next
  g12-ls/integration.json   ← next
  g12-ls/probability.json   ← next
  g12-se/…                  ← SE topics later
  g12-gs/…                  ← GS topics later
  g9/…                      ← Brevet later
```

One JSON file = one topic contest. LS official-style contests typically split into about **four** topic banks. **Functions** is topic 1: Limits (first slice, with classroom video) → Continuity → Derivatives.

## JSON shape

Each question:

- `slice` — subtopic inside the file (`limits`, `continuity`, `derivatives`, …)
- `difficulty` — `easy` | `medium` | `hard`
- `source.kind` — `generated-in-official-style` or `session-extract`
- `source.models` — e.g. `["LS all sessions.pdf"]`
- `stem`, `latex`, `choices`, `answerIndex`, `answer`, `solutionSketch`

Keep the array **easy → medium → hard**. Within a band, keep pedagogical slice order (for Functions: limits, then continuity, then derivatives).

## How to add the next topic (example: vectors)

1. Filter the matching official session PDF for that topic only (LS vectors / space geometry, not Functions).
2. Copy `functions.json` to `content/banks/g12-ls/vectors.json`.
3. Change `id` to `g12-ls-vectors`, `topic` / titles, `sourceModels`, and `slices`.
4. Replace `questions` with new stems in official-session style. Tag genuine extracts `session-extract`; keep academy-original siblings `generated-in-official-style`. Never paste a copyrighted exam page verbatim.
5. Register the file in `src/lib/topicBanks.ts` (`import` + `topicBanks` array). The practice hub lists every registered bank.
6. `npm run build`.

Same steps for `integration.json`, then SE/GS tracks under `content/banks/g12-se/` and `content/banks/g12-gs/`.

## Student URLs (Functions pilot)

- Contest (16 questions, easy→hard, 25 min): `/practice/take?bank=g12-ls-functions&mode=contest`
- Full bank training (ordered): `/practice/take?bank=g12-ls-functions&mode=free`
- Limits lesson only (first slice + video): `/classroom/grade-12-ch1` and `/practice/take?lessonId=grade-12-ch1`
