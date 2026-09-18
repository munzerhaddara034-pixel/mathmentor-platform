# Math Formatting (Lebanese booklet / Word Insert Equation)

Prof. Munzer Haddara / الأستاذ منذر حداره. Never Al-Tarah / الطارة.

Student-facing mathematics on MathMentor must match **Lebanese official exam papers** and **Microsoft Word → Insert Equation**. There are no exceptions in the student UI.

**Single source of truth:** [`src/lib/math/lebaneseEquationFormat.ts`](../src/lib/math/lebaneseEquationFormat.ts). Do not add a second formatter.

Voice-to-Math (PR #12) already owns this module and wires it through the canvas, solver, and Whisper cleaning layer. This document is the student-visible contract.

## Strict visible rules

| Topic | Forbidden in student UI | Required (Word-style LaTeX) |
| --- | --- | --- |
| Fractions | Slash `/` such as `1/x`, `(x+1)/(x-1)` | Stacked `\frac{a}{b}` |
| Powers | Raw caret text `x^2` | True superscript `x^{2}`, `e^{3x-1}` |
| Radicals | The word `sqrt` | `\sqrt{...}` with a vinculum |
| Limits | `lim x->a` beside the operator | `\lim\limits_{x \to a}` (condition under the symbol) |
| Integrals | ASCII `int_a^b` | `\int\limits_{a}^{b}` (bounds above and below) |

Prose slashes that are **not** fractions stay as bilingual separators: `Show that / Montrer que`, `Key Idea / Exam Tip`.

Graph `fn` strings are **JavaScript** (`Math.sqrt(x)/x`) and must never be rewritten as `\frac`. `formatLatexFields` only walks keys named `latex`, `math_latex`, `finalAnswerLatex`, and `latexDraft`.

## Public API

| Function | Role |
| --- | --- |
| `formatLebaneseEquation(tex)` | Rewrite pseudo-LaTeX to booklet form. Idempotent. |
| `spokenMathToLebaneseLatex(spoken)` | Whisper / demo Arabic–English phrases, then `formatLebaneseEquation`. |
| `hasForbiddenEquationForm(tex)` | Guardrail: leftover slash fraction, unbraced caret, or the word `sqrt`. |
| `formatLatexFields(value)` | Deep-clean known LaTeX keys; leave `fn` / graph payloads alone. |
| `formatMathIslands(prose)` | Clean `$...$` / `\[...\]` islands inside question-bank prompts. |

KaTeX settings: `katex.renderToString` in [`src/components/studio/Katex.tsx`](../src/components/studio/Katex.tsx) with `trust: false`, `throwOnError: false`. Every `Katex` / `MathTex` call runs `formatLebaneseEquation` first. Mixed prose uses [`MixedMathText`](../src/components/studio/MixedMathText.tsx).

## Before / after

| Input (typed, spoken, or Whisper) | After the cleaning layer |
| --- | --- |
| `1/x` | `\frac{1}{x}` |
| `(x+1)/(x-1)` | `\frac{x+1}{x-1}` |
| `x^2`, `x^10` | `x^{2}`, `x^{10}` |
| `sqrt(x)`, `sqrt(2x+1)` | `\sqrt{x}`, `\sqrt{2x+1}` |
| `lim x->+inf` | `\lim\limits_{x \to +\infty}` |
| `\int_0^1` | `\int\limits_{0}^{1}` |
| «إكس سكوير» / “x squared” | `x^{2}` |
| «واحد على إكس» / “one over x” | `\frac{1}{x}` |
| «جذر إكس» | `\sqrt{x}` |
| «نهاية عند الزائد إنفينيتي» | `\lim\limits_{x \to +\infty}` |

## Pipeline

```
typed / photo / Whisper transcript
        │
        ▼
spokenMathToLebaneseLatex     Arabic / English speech → LaTeX fragments
        │
        ▼
formatLebaneseEquation        1/x, x^2, sqrt(...), lim, int
        │
        ▼
formatLatexFields             canvas / solver JSON (`latex` keys only)
        │
        ▼
Katex / MathTex / MixedMathText
        │
        ▼
Math Canvas / solver sheet / quiz / exam / Voice-to-Math board
```

Voice-to-Math order is fixed: **Whisper → `spokenMathToLebaneseLatex` → canvas `renderMath`**. See [VOICE_MATH.md](./VOICE_MATH.md). Pedagogy sequence (D_f, limits, variation table, boxed answers) is unchanged; see [PEDAGOGY.md](./PEDAGOGY.md).

## Where it is enforced

| Surface | How |
| --- | --- |
| Interactive Math Canvas | `latexOf` in `src/lib/studio/timeline.ts` → `Katex` |
| AI solver sheet | `assembleSolution` + `formatLatexFields` |
| Voice-to-Math | `src/lib/voiceMath/engine.ts` after Whisper |
| Question bank / quiz | `MathTex` on `latex`; `MixedMathText` + `formatMathIslands` on prompt / options / steps |
| Exam simulator + formula drawer | `Katex` on `sub.latex` / sheets; `MixedMathText` on prompts |
| Custom questions API | `POST`/`PATCH` `/api/questions` stores cleaned `latex` and math islands |
| AI pedagogy prompts | `src/lib/pedagogy/lebanese.ts` forbids slash fractions, caret-as-text, and `sqrt` |

## Tests

```bash
npx tsx scripts/verify-lebanese-equation-format.ts
npx tsx scripts/verify-voice-math.ts
```

Covers stacked fractions, braced superscripts, radicals, `\lim\limits` / `\int\limits`, Arabic spoken phrases, idempotence, graph `fn` preservation, quiz-bank / formula-sheet / exam latex, and `$...$` islands in prompts.
