# Lebanese Official Curriculum Pedagogy

Prof. Munzer Haddara / الأستاذ منذر حداره. Never Al-Tarah / الطارة.

This is the mandated explanation engine for **every** AI solve, avatar script, and interactive lesson on MathMentor. Source of truth: `src/lib/pedagogy/lebanese.ts`. Repair layer: `src/lib/studio/pedagogy.ts` (`ensurePedagogy`). Canvas clock: `src/lib/studio/timeline.ts`.

## Mandated sequence (real-function study)

When the problem is an *étude de fonction*, solutions and scripts **must** follow this order. Geometry, complex numbers, and probability keep the **same rigor**, adapted to the objects of the paper.

| Stage | English | Français | What the barème marks |
| --- | --- | --- | --- |
| 0 | **Key Idea / Exam Tip** | Idée clé / Conseil d’épreuve | How we think about the question — **before any calculation** |
| 1 | **Domain of definition D_f** | Ensemble de définition D_f | Written **first**, justified from the expressions that appear. No invented restriction. |
| 2 | **Limits at the boundaries & asymptotes** | Limites aux bornes et asymptotes | Name the indeterminate form, rewrite, conclude. Write the equation: `x=a` (vertical), `y=b` (horizontal), `y=ax+b` (oblique). |
| 3 | **Derivative, sign, table of variations** | Dérivée, signe, tableau de variation | Named rule for f'. Sign chart. Full table: **arrows, limits, images** — not only the sign of f'. |
| 4 | **Particular points & graph of C_f** | Points particuliers et allure de C_f | Axis intercepts, extrema, accurate sketch/plot. |
| 5 | **Boxed exercise** | Exercice encadré | Each sub-question ends with a **Boxed Final Answer** aligned to the mark distribution. |
| 6 | **Common pitfalls** | Pièges fréquents | Shortcuts that lose barème marks, then the correction. |

Studio JSON still ships four playback phases that **wrap** this sequence:

1. `introduction` — Key Idea + D_f  
2. `rule_graph` — limits/asymptotes → variation table → plot of C_f (avatar paused)  
3. `real_example` — official exercise with `boxAnswer` on each sub-question  
4. `common_mistake` — pitfalls  

## Official exam verbs (EN + FR in parallel)

Use these in bilingual fields wherever the platform is already EN/FR:

- Show that / Montrer que  
- Deduce / En déduire  
- Calculate / Calculer  
- Interpret geometrically / Interpréter géométriquement  
- Vector / Vecteur  
- System / Système  
- Complex form z = a + ib / forme algébrique z = a + ib  
- Intermediate Value Theorem / Théorème des valeurs intermédiaires  

**IVT is forbidden** unless continuity on the interval **and** strict monotonicity have already been written.

## Forbidden shortcuts

These score zero:

- `(−∞)×0 = 0` or `∞/∞ = 1` without rewriting  
- Skipping D_f, or inventing a restriction  
- Naming an asymptote without `x=a`, `y=b`, or `y=ax+b`  
- IVT without continuity + monotonicity  
- `f'(x)=e^x` for `(x−1)e^x`, or the power rule on `e^x`  
- Jumping to a boxed number without the hypothesis of the theorem  

## Canvas triggers

Synced to avatar audio (`video.currentTime`):

| Type | Alias | Board |
| --- | --- | --- |
| `renderMath` | `show_equation` / `fade_equation` | KaTeX |
| `plotFunction` | `render_graph` | C_f with roots / extrema / asymptotes |
| `variationTable` | — | Tableau de variation |
| `boxAnswer` | `show_step` + `boxed` | Prominent boxed final answer |
| `exam_tip` | `examTip` | Key Idea banner **before** calculations |

Demo lesson `leb-term-func-01` (`/lessons/interactive`) is the reference: f(x)=(x−1)e^x with chapters **Intro → Domain → Limits → Variation → Graph → Boxed exercise → Pitfalls**.

## Solver 3-part sheet

Unchanged contract, now sitting on top of the sequence:

1. **Given & Aim** (`given.latex`, `aimEn` / `aimFr` / `aimAr`)  
2. **Step-by-step** with theorem + justification on every line (for a function study: Domain → Limits → Variation → Points)  
3. **Final Answer Box** (`finalAnswerLatex`)

Plus `examTip` (spoken first in the avatar script) and `trap` (common pitfalls). Pure LaTeX only. Hallucination guard: unclear images return `needsRetake` and **do not invent** a problem.

Without `GEMINI_API_KEY` / `OPENAI_API_KEY`, the deterministic demo solver still emits this structure (try `f(x)=(x-1)e^x`).

## Where it is enforced

| Surface | File |
| --- | --- |
| Shared rules + LLM prompts | `src/lib/pedagogy/lebanese.ts` |
| Timeline repair (injects missing tip / D_f / limits / table / box / graph) | `src/lib/studio/pedagogy.ts` |
| AI solver system prompt + JSON schema | `src/lib/solver/llm.ts` |
| Demo stubs | `src/lib/solver/demoSolver.ts`, `src/lib/solver/assemble.ts` |
| Video script generator | `src/lib/studio/scriptGenerator.ts` |
| Seed lesson | `src/lib/studio/seedLesson.ts` (`leb-term-func-01`) |
| Interactive player | `/lessons/interactive`, `MathCanvas` |
| Script API audit | `POST /api/studio/script` → `pedagogy` object |

See also [AI_SOLVER.md](./AI_SOLVER.md) and [STUDIO.md](./STUDIO.md).
