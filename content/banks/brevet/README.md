# Brevet topic banks — الشهادة المتوسطة (Grade 9)

Two certificate levels live under `content/banks/`:

1. **Grade 12 LS** — `g12-ls/` (Functions / Problem IV is live)
2. **Brevet** — this folder

Official Grade 9 contest PDFs stay on Munzer’s PC. Do **not** photocopy them into Git. New items are tagged `generated-in-official-style` and must **not** be presented as past papers.

## Typical Brevet paper (~6–7 problems)

| Bank | Arabic | Status |
| --- | --- | --- |
| `numbers.json` | الأعداد (radicals, scientific notation, irreducible fractions) | later |
| `algebra.json` | الجبر (expand, factor, equations, inequalities, systems) | **seeded** |
| `word_problems.json` | المسائل اللفظية (percentages, contextual systems) | later |
| `geometry.json` | الهندسة (triangles, circles, similarity, Thales, transformations, right-triangle trig) | **seeded** |
| `coordinate.json` | الهندسة التحليلية (orthonormal plane, line equations, perpendicular bisectors) | later |

Pilot order: **geometry + algebra first** (highest exam weight), then numbers, word problems, coordinate.

Difficulty inside each file: **easy → medium → hard**, Lebanese Brevet rigor (not primary-school easy).

## Student URLs

- Geometry contest: `/practice/take?bank=brevet-geometry&mode=contest`
- Algebra contest: `/practice/take?bank=brevet-algebra&mode=contest`
- Full-bank training: add `&mode=free`
- Hub: `/practice`

Rebuild after editing `scripts/build-brevet-banks.py`:

```bash
python3 scripts/build-brevet-banks.py
```
