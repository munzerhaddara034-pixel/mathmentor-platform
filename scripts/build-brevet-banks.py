#!/usr/bin/env python3
"""Seed Brevet (Grade 9 / الشهادة المتوسطة) geometry + algebra topic banks.

Items follow official contest wording (isosceles with principal vertex, circle of
diameter, expand/factor E(x), linear systems) but use original numbers.
They are NOT past papers.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "content/banks/brevet"

SOURCE = {
    "kind": "generated-in-official-style",
    "models": ["Grade 9 / Brevet official contests pack"],
    "note": "Academy-original. Patterned on Lebanese Brevet (الشهادة المتوسطة) wording. Not a photocopy of any past paper.",
}

BAND = {"easy": 0, "medium": 1, "hard": 2}

BREVET_TOPICS = [
    {"id": "numbers", "file": "content/banks/brevet/numbers.json", "title": "Numbers", "arabicTitle": "الأعداد", "implemented": False},
    {"id": "algebra", "file": "content/banks/brevet/algebra.json", "title": "Algebra", "arabicTitle": "الجبر", "implemented": True},
    {"id": "word_problems", "file": "content/banks/brevet/word_problems.json", "title": "Word problems", "arabicTitle": "المسائل اللفظية", "implemented": False},
    {"id": "geometry", "file": "content/banks/brevet/geometry.json", "title": "Geometry", "arabicTitle": "الهندسة", "implemented": True},
    {"id": "coordinate", "file": "content/banks/brevet/coordinate.json", "title": "Coordinate geometry", "arabicTitle": "الهندسة التحليلية", "implemented": False},
]


def item(qid, slice_id, difficulty, stem, choices, answer_index, sketch, latex=None, tag=""):
    row = {
        "id": qid,
        "slice": slice_id,
        "difficulty": difficulty,
        "source": {**SOURCE, "tag": tag or slice_id},
        "stem": stem,
        "choices": choices,
        "answerIndex": answer_index,
        "answer": choices[answer_index],
        "solutionSketch": sketch,
    }
    if latex:
        row["latex"] = latex
    return row


GEO_SLICES = [
    {"id": "circle", "title": "Circle", "arabicTitle": "الدائرة"},
    {"id": "triangle", "title": "Triangles", "arabicTitle": "المثلثات"},
    {"id": "similar", "title": "Similarity", "arabicTitle": "التشابه"},
    {"id": "thales", "title": "Thales", "arabicTitle": "طاليس"},
    {"id": "transformation", "title": "Transformations", "arabicTitle": "التحويلات"},
    {"id": "trig", "title": "Right-triangle trigonometry", "arabicTitle": "حساب مثلثات القائم"},
]
GEO_RANK = {s["id"]: i for i, s in enumerate(GEO_SLICES)}

GEO = [
    item(
        "brevet-geo-circ-01",
        "circle",
        "easy",
        "ABC is inscribed in a circle of diameter [AB]. Then angle ACB equals:",
        ["\\(45^\\circ\\)", "\\(90^\\circ\\)", "\\(60^\\circ\\)", "\\(180^\\circ\\)"],
        1,
        [
            "The angle inscribed in a semicircle is a right angle (Thales’ theorem on the circle).",
            "Trap: 60° as if ABC were equilateral.",
        ],
        tag="diameter-right-angle",
    ),
    item(
        "brevet-geo-circ-02",
        "circle",
        "easy",
        "A circle has diameter 14 cm. Its radius is:",
        ["14 cm", "7 cm", "28 cm", "21 cm"],
        1,
        ["Radius is half the diameter: 14/2 = 7 cm."],
        latex="R=d/2",
        tag="radius",
    ),
    item(
        "brevet-geo-circ-03",
        "circle",
        "medium",
        "A circle of diameter [AB] has radius 5 cm. Point M lies on the circle, AM = 6 cm. Then BM equals:",
        ["8 cm", "5 cm", "\\(4\\) cm", "10 cm"],
        0,
        [
            "Triangle AMB is right-angled at M, and AB = 10.",
            "BM = √(AB² − AM²) = √(100 − 36) = 8.",
        ],
        latex="AM^2+BM^2=AB^2",
        tag="semicircle-pythagoras",
    ),
    item(
        "brevet-geo-circ-04",
        "circle",
        "medium",
        "O is the center of a circle of radius 5. Chord [CD] has length 8. The distance from O to [CD] is:",
        ["3 cm", "4 cm", "5 cm", "2 cm"],
        0,
        [
            "The perpendicular from the center to a chord bisects the chord: half-chord = 4.",
            "Distance = √(5² − 4²) = 3.",
        ],
        tag="chord-distance",
    ),
    item(
        "brevet-geo-circ-05",
        "circle",
        "hard",
        "ABC is right-angled at C with AC = 6 and BC = 8. The radius of the circle circumscribed about triangle ABC is:",
        ["5", "7", "10", "4"],
        0,
        [
            "In a right triangle the circumcenter is the midpoint of the hypotenuse.",
            "AB = 10, so R = 5. Trap: taking R = AB = 10.",
        ],
        latex="R=AB/2",
        tag="circumradius-right",
    ),
    item(
        "brevet-geo-tri-01",
        "triangle",
        "easy",
        "ABC is isosceles with principal vertex A and AB = AC. If angle BAC = 40°, then angle ABC equals:",
        ["\\(40^\\circ\\)", "\\(70^\\circ\\)", "\\(100^\\circ\\)", "\\(50^\\circ\\)"],
        1,
        ["Base angles are equal: (180° − 40°)/2 = 70°."],
        tag="isosceles-base-angle",
    ),
    item(
        "brevet-geo-tri-02",
        "triangle",
        "easy",
        "ABC is right-angled at C with AC = BC = 6 cm. Then AB equals:",
        ["6 cm", "\\(6\\sqrt{2}\\) cm", "12 cm", "\\(3\\sqrt{2}\\) cm"],
        1,
        ["Isosceles right triangle: hypotenuse = 6√2."],
        latex="AB=6\\sqrt{2}",
        tag="isosceles-right",
    ),
    item(
        "brevet-geo-tri-03",
        "triangle",
        "medium",
        "ABC is isosceles with principal vertex A, BC = 10 cm and AB = AC = 13 cm. Let I be the midpoint of [BC]. Then AI equals:",
        ["12 cm", "8 cm", "√69 cm", "5 cm"],
        0,
        [
            "The altitude from the principal vertex is also a median: BI = 5.",
            "AI = √(13² − 5²) = √(169 − 25) = 12.",
        ],
        latex="AI=\\sqrt{13^2-5^2}",
        tag="isosceles-altitude",
    ),
    item(
        "brevet-geo-tri-04",
        "triangle",
        "medium",
        "In triangle ABC, (AI) is the perpendicular bisector of [BC]. Then:",
        ["AB = AC", "angle B = 90°", "I is the midpoint of [AB]", "BC = AI"],
        0,
        [
            "Any point of the perpendicular bisector of [BC] is equidistant from B and C, so AB = AC.",
        ],
        tag="perp-bisector-isosceles",
    ),
    item(
        "brevet-geo-tri-05",
        "triangle",
        "hard",
        "ABCD is a rectangle with AB = 8 cm and AD = 6 cm. The four vertices lie on a circle of radius:",
        ["5 cm", "7 cm", "10 cm", "4 cm"],
        0,
        [
            "A rectangle is cyclic; the diagonal is a diameter: AC = 10, radius 5.",
            "Trap: using a side as diameter.",
        ],
        tag="rectangle-cyclic",
    ),
    item(
        "brevet-geo-sim-01",
        "similar",
        "easy",
        "Triangles ABC and A′B′C′ are similar with ratio k = 2. If AB = 5 cm, then A′B′ equals:",
        ["2.5 cm", "10 cm", "7 cm", "25 cm"],
        1,
        ["Corresponding sides scale by k: 5 × 2 = 10."],
        tag="similarity-ratio",
    ),
    item(
        "brevet-geo-sim-02",
        "similar",
        "medium",
        "ABC is right-angled at C. The altitude from C meets [AB] at H. Then triangles ACH and ABC are similar because:",
        [
            "they have the same hypotenuse",
            "they share angle A, and both are right-angled",
            "CH is a median",
            "AC = BC",
        ],
        1,
        [
            "AA criterion: both right-angled, and they share angle A.",
            "This is the usual geometric-mean setup of Brevet sessions.",
        ],
        tag="altitude-to-hypotenuse",
    ),
    item(
        "brevet-geo-sim-03",
        "similar",
        "medium",
        "ABC ~ DEF with ratio 3 (ABC to DEF). The ratio of their areas is:",
        ["3", "6", "9", "1/3"],
        2,
        ["Areas scale by the square of the similarity ratio: 3² = 9."],
        tag="area-ratio",
    ),
    item(
        "brevet-geo-sim-04",
        "similar",
        "hard",
        "ABC is right-angled at C, AB = 13, AC = 5, BC = 12. The altitude from C to [AB] has length:",
        ["\\(60/13\\)", "6", "5", "12/13"],
        0,
        [
            "Area two ways: (AC·BC)/2 = (AB·CH)/2, so CH = (5×12)/13 = 60/13.",
            "Trap: taking CH as a geometric mean without the product over AB.",
        ],
        latex="CH=\\frac{AC\\cdot BC}{AB}",
        tag="right-altitude-length",
    ),
    item(
        "brevet-geo-tha-01",
        "thales",
        "easy",
        "In triangle ABC, (DE) is parallel to (BC) with D on [AB] and E on [AC]. If AD/AB = 2/5, then AE/AC equals:",
        ["5/2", "2/5", "3/5", "1/2"],
        1,
        ["Thales: a parallel to one side cuts the other two sides proportionally."],
        latex="\\frac{AD}{AB}=\\frac{AE}{AC}",
        tag="thales-ratio",
    ),
    item(
        "brevet-geo-tha-02",
        "thales",
        "medium",
        "In triangle ABC, (MN)//(BC) with M on [AB], N on [AC]. AM = 4, MB = 6, AC = 15. Then AN equals:",
        ["6", "10", "9", "4"],
        0,
        [
            "AM/AB = 4/10 = 2/5, so AN = (2/5)×15 = 6.",
            "Trap: using AM/MB = 4/6 and writing AN = 10.",
        ],
        latex="\\frac{AM}{AB}=\\frac{AN}{AC}",
        tag="thales-length",
    ),
    item(
        "brevet-geo-tha-03",
        "thales",
        "medium",
        "The midline of triangle ABC joining the midpoints of [AB] and [AC]:",
        ["equals BC and is parallel to (BC)", "is parallel to (BC) and equal to BC/2", "passes through A", "is a median"],
        1,
        ["Midline (mid-segment) theorem: parallel to the third side and half as long."],
        tag="midline",
    ),
    item(
        "brevet-geo-tha-04",
        "thales",
        "hard",
        "In triangle ABC, (DE)//(BC), AD = 3, DB = 6, BC = 12. Then DE equals:",
        ["4", "6", "8", "3"],
        0,
        [
            "AD/AB = 3/9 = 1/3, so DE = BC/3 = 4.",
            "Trap: DE = BC/2 because D looks like a midpoint (it is not: AD ≠ DB).",
        ],
        tag="thales-third-side",
    ),
    item(
        "brevet-geo-trf-01",
        "transformation",
        "easy",
        "M is the image of A by the translation of vector AB. Then M is:",
        ["the midpoint of [AB]", "point B", "point A", "a point such that AM = 2 AB"],
        1,
        ["Translation of A by vector AB sends A to B."],
        latex="t_{\\overrightarrow{AB}}(A)=B",
        tag="translation-endpoint",
    ),
    item(
        "brevet-geo-trf-02",
        "transformation",
        "medium",
        "M is the image of A by the translation of vector BC. Quadrilateral ABCM is:",
        ["a rectangle", "a parallelogram", "a rhombus", "a kite"],
        1,
        [
            "AM = BC (equal and parallel), so ABCM is a parallelogram.",
            "It is a rectangle or rhombus only with extra hypotheses.",
        ],
        tag="translation-parallelogram",
    ),
    item(
        "brevet-geo-trf-03",
        "transformation",
        "medium",
        "A translation maps a line (d) to a line (d′). Then (d) and (d′) are:",
        ["perpendicular", "secant at one point", "parallel (or coincident)", "always coincident"],
        2,
        ["A translation maps a line to a parallel line (the same line if the vector is parallel to it)."],
        tag="translation-line",
    ),
    item(
        "brevet-geo-trf-04",
        "transformation",
        "hard",
        "In the plane, A(1 ; 2) and vector BC = (4 ; −1). The image of A by the translation of vector BC is:",
        ["(5 ; 1)", "(4 ; −1)", "(3 ; 3)", "(1 ; 1)"],
        0,
        ["Image = (1+4 ; 2+(−1)) = (5 ; 1). Trap: writing the vector itself as the image."],
        latex="(1,2)+(4,-1)=(5,1)",
        tag="translation-coordinates",
    ),
    item(
        "brevet-geo-trig-01",
        "trig",
        "easy",
        "In a right triangle with opposite side 3 and hypotenuse 5, sin of that acute angle equals:",
        ["\\(3/4\\)", "\\(3/5\\)", "\\(4/5\\)", "\\(4/3\\)"],
        1,
        ["sin = opposite / hypotenuse = 3/5."],
        latex="\\sin=\\frac{opp}{hyp}",
        tag="sine-def",
    ),
    item(
        "brevet-geo-trig-02",
        "trig",
        "easy",
        "In a right triangle with opposite 3 and adjacent 4, tan of that acute angle equals:",
        ["\\(3/5\\)", "\\(3/4\\)", "\\(4/3\\)", "\\(4/5\\)"],
        1,
        ["tan = opposite / adjacent = 3/4. Trap: 4/3 (the complementary angle)."],
        latex="\\tan=\\frac{opp}{adj}",
        tag="tan-def",
    ),
    item(
        "brevet-geo-trig-03",
        "trig",
        "medium",
        "ABC is right-angled at C, AC = 8, BC = 6. Then tan of angle A equals:",
        ["\\(3/4\\)", "\\(4/3\\)", "\\(6/10\\)", "\\(8/6\\)"],
        0,
        [
            "Opposite to A is BC = 6, adjacent is AC = 8, so tan A = 6/8 = 3/4.",
            "Trap: 4/3 (that is tan B) or using the hypotenuse.",
        ],
        latex="\\tan A=\\frac{BC}{AC}",
        tag="tan-in-triangle",
    ),
    item(
        "brevet-geo-trig-04",
        "trig",
        "medium",
        "ABC is right-angled at C with AB = 10 and AC = 6. Then sin of angle B equals:",
        ["\\(3/5\\)", "\\(4/5\\)", "\\(6/8\\)", "\\(8/6\\)"],
        0,
        [
            "BC = 8. Opposite to B is AC = 6, hypotenuse 10, so sin B = 6/10 = 3/5.",
        ],
        tag="sin-B",
    ),
    item(
        "brevet-geo-trig-05",
        "trig",
        "hard",
        "ABC is right-angled at C, AC = 5, BC = 12. Rounded to the nearest degree, angle A is nearest to:",
        ["\\(22^\\circ\\)", "\\(23^\\circ\\)", "\\(67^\\circ\\)", "\\(45^\\circ\\)"],
        2,
        [
            "tan A = 12/5 = 2.4, and tan 67° ≈ 2.36, tan 22° ≈ 0.40.",
            "So A ≈ 67°. Trap: 23° (that is approximately angle B).",
        ],
        latex="\\tan A=12/5",
        tag="angle-nearest-degree",
    ),
    item(
        "brevet-geo-circ-06",
        "circle",
        "hard",
        "From a point P outside a circle, a tangent [PT] and a secant through A then B are drawn, with PA = 4 and PB = 9. Then PT equals:",
        ["6", "√13", "36", "5"],
        0,
        [
            "Power of a point: PT² = PA × PB = 36, so PT = 6.",
            "Trap: adding 4+9 or taking √(9−4).",
        ],
        latex="PT^2=PA\\times PB",
        tag="power-of-point",
    ),
    item(
        "brevet-geo-tri-06",
        "triangle",
        "hard",
        "The perpendicular bisectors of [AB] and [BC] meet at H. Then HA, HB and HC are:",
        ["altitudes of triangle ABC", "equal (H is the circumcenter)", "medians", "always parallel to the sides"],
        1,
        [
            "The intersection of perpendicular bisectors is the circumcenter: HA = HB = HC = R.",
        ],
        tag="circumcenter",
    ),
    item(
        "brevet-geo-sim-05",
        "similar",
        "hard",
        "ABC is right-angled at C. H is the foot of the altitude from C to [AB]. Then AH × AB equals:",
        ["AC × BC", "AC²", "CH²", "BC²"],
        1,
        [
            "Geometric mean: AC² = AH × AB (leg is the geometric mean of hypotenuse and adjacent projection).",
        ],
        latex="AC^2=AH\\times AB",
        tag="geometric-mean",
    ),
]

ALG_SLICES = [
    {"id": "expand", "title": "Expand", "arabicTitle": "النشر"},
    {"id": "factor", "title": "Factor", "arabicTitle": "التحليل"},
    {"id": "equation", "title": "Equations", "arabicTitle": "المعادلات"},
    {"id": "inequality", "title": "Inequalities", "arabicTitle": "المتراجحات"},
    {"id": "system", "title": "Linear systems", "arabicTitle": "الجمل الخطية"},
    {"id": "expression", "title": "Expressions", "arabicTitle": "العبارات"},
]
ALG_RANK = {s["id"]: i for i, s in enumerate(ALG_SLICES)}

ALG = [
    item(
        "brevet-alg-exp-01",
        "expand",
        "easy",
        "Expand (3x − 1)². The result is:",
        ["\\(9x^2-1\\)", "\\(9x^2-6x+1\\)", "\\(9x^2+6x+1\\)", "\\(6x^2-3x+1\\)"],
        1,
        ["(a−b)² = a² − 2ab + b² with a = 3x, b = 1 → 9x² − 6x + 1.", "Trap: forgetting the middle term."],
        latex="(3x-1)^2",
        tag="square-binomial",
    ),
    item(
        "brevet-alg-exp-02",
        "expand",
        "easy",
        "Expand (x + 4)(x − 4). The result is:",
        ["\\(x^2-8x+16\\)", "\\(x^2-16\\)", "\\(x^2+16\\)", "\\(2x\\)"],
        1,
        ["Difference of squares: (a+b)(a−b) = a² − b²."],
        latex="(x+4)(x-4)=x^2-16",
        tag="difference-squares-expand",
    ),
    item(
        "brevet-alg-exp-03",
        "expand",
        "medium",
        "Expand and reduce (2x − 5)² + (x + 1)(3x − 2). The result is:",
        ["\\(7x^2-18x+23\\)", "\\(7x^2-21x+27\\)", "\\(4x^2-20x+25\\)", "\\(7x^2-10x+23\\)"],
        0,
        [
            "(2x−5)² = 4x² − 20x + 25.",
            "(x+1)(3x−2) = 3x² − 2x + 3x − 2 = 3x² + x − 2.",
            "Sum: 7x² − 19x + 23. Wait — −20x + x = −19x. Recheck choices.",
        ],
        latex="(2x-5)^2+(x+1)(3x-2)",
        tag="expand-reduce",
    ),
]


def fix_expand_03():
    # 4x^2-20x+25 + 3x^2+x-2 = 7x^2 -19x +23
    ALG[2]["choices"] = ["\\(7x^2-19x+23\\)", "\\(7x^2-21x+27\\)", "\\(4x^2-20x+25\\)", "\\(7x^2-18x+23\\)"]
    ALG[2]["answerIndex"] = 0
    ALG[2]["answer"] = ALG[2]["choices"][0]
    ALG[2]["solutionSketch"] = [
        "(2x−5)² = 4x² − 20x + 25 and (x+1)(3x−2) = 3x² + x − 2.",
        "Sum: 7x² − 19x + 23. Trap: dropping the middle term of the square.",
    ]


fix_expand_03()

ALG.extend(
    [
        item(
            "brevet-alg-fac-01",
            "factor",
            "easy",
            "Factorize 9x² − 16. The result is:",
            ["\\((9x-16)(x+1)\\)", "\\((3x-4)(3x+4)\\)", "\\((3x-16)(3x+1)\\)", "cannot be factorized"],
            1,
            ["Difference of squares: a² − b² = (a−b)(a+b) with a = 3x, b = 4."],
            latex="9x^2-16=(3x-4)(3x+4)",
            tag="diff-squares",
        ),
        item(
            "brevet-alg-fac-02",
            "factor",
            "easy",
            "Factorize 6x² + 9x. The result is:",
            ["\\(3x(2x+3)\\)", "\\(6x(x+9)\\)", "\\(3(2x^2+3)\\)", "\\(x(6x+9x)\\)"],
            0,
            ["Common factor 3x: 3x(2x + 3)."],
            latex="6x^2+9x=3x(2x+3)",
            tag="common-factor",
        ),
        item(
            "brevet-alg-fac-03",
            "factor",
            "medium",
            "Given E(x) = (x − 2)² + (x − 2)(x + 5). A factorization of E(x) is:",
            ["\\((x-2)(2x+3)\\)", "\\((x-2)(x+5)\\)", "\\((x-2)^2(x+5)\\)", "\\(2(x-2)\\)"],
            0,
            [
                "Factor (x−2): E(x) = (x−2)[(x−2) + (x+5)] = (x−2)(2x+3).",
                "Trap: stopping after seeing the second product only.",
            ],
            latex="E(x)=(x-2)(2x+3)",
            tag="factor-common-binomial",
        ),
        item(
            "brevet-alg-fac-04",
            "factor",
            "medium",
            "Factorize E(x) = (3x + 1)² + (x − 4)(3x + 1). The result is:",
            ["\\((3x+1)(4x-3)\\)", "\\((3x+1)(x-4)\\)", "\\((3x+1)^2\\)", "\\(4x(3x+1)\\)"],
            0,
            ["E(x) = (3x+1)[3x+1 + x − 4] = (3x+1)(4x − 3)."],
            latex="E(x)=(3x+1)(4x-3)",
            tag="factor-E",
        ),
        item(
            "brevet-alg-fac-05",
            "factor",
            "hard",
            "Let E(x) = (1 − 3x)² + (9x² − 1) + 2(1 − 3x)(x + 2). After expansion, E(x) equals:",
            ["\\(4(3x-1)(x-1)\\)", "\\(12x^2\\)", "\\((1-3x)^2\\)", "\\(4(3x+1)(x+1)\\)"],
            0,
            [
                "Expand: (1 − 6x + 9x²) + (9x² − 1) + (−6x² − 10x + 4) = 12x² − 16x + 4.",
                "12x² − 16x + 4 = 4(3x² − 4x + 1) = 4(3x − 1)(x − 1).",
            ],
            latex="E(x)=4(3x-1)(x-1)",
            tag="expand-then-factor",
        ),
        item(
            "brevet-alg-eq-01",
            "equation",
            "easy",
            "Solve 5x − 3 = 2x + 9. The solution is:",
            ["\\(x=2\\)", "\\(x=4\\)", "\\(x=6\\)", "\\(x=-4\\)"],
            1,
            ["3x = 12, so x = 4. Check: 20 − 3 = 8 + 9."],
            latex="5x-3=2x+9",
            tag="linear-eq",
        ),
        item(
            "brevet-alg-eq-02",
            "equation",
            "easy",
            "Solve (5x − 2)(x + 3) = 0. The solutions are:",
            ["\\(x=2/5\\) or \\(x=-3\\)", "\\(x=-2/5\\) or \\(x=3\\)", "\\(x=5/2\\) or \\(x=-3\\)", "no solution"],
            0,
            ["A product is zero iff a factor is zero: x = 2/5 or x = −3."],
            tag="product-zero",
        ),
        item(
            "brevet-alg-eq-03",
            "equation",
            "medium",
            "Let E(x) = 4x² + 9. The equation E(x) = 25 has solutions:",
            ["\\(x=\\pm 2\\)", "\\(x=\\pm 4\\)", "\\(x=4\\)", "no real solution"],
            0,
            ["4x² = 16, x² = 4, x = ±2. Trap: taking only the positive root."],
            latex="4x^2+9=25",
            tag="quadratic-two-roots",
        ),
        item(
            "brevet-alg-eq-04",
            "equation",
            "medium",
            "Solve 3x² − 12x = 0. The solutions are:",
            ["\\(x=0\\) or \\(x=4\\)", "\\(x=4\\) only", "\\(x=0\\) only", "\\(x=12\\)"],
            0,
            ["3x(x − 4) = 0, so x = 0 or x = 4. Trap: dividing by x and losing x = 0."],
            latex="3x(x-4)=0",
            tag="factor-equation",
        ),
        item(
            "brevet-alg-eq-05",
            "equation",
            "hard",
            "Using E(x) = (3x + 1)(4x − 3), the solutions of E(x) = 0 are:",
            ["\\(x=-1/3\\) or \\(x=3/4\\)", "\\(x=1/3\\) or \\(x=-3/4\\)", "\\(x=-1/3\\) only", "\\(x=3\\)"],
            0,
            ["3x + 1 = 0 or 4x − 3 = 0."],
            tag="factored-E-zero",
        ),
        item(
            "brevet-alg-eq-06",
            "equation",
            "hard",
            "Solve 2x² + 6x − 20 = 0. The solutions are:",
            ["\\(x=2\\) or \\(x=-5\\)", "\\(x=-2\\) or \\(x=5\\)", "\\(x=10\\)", "\\(x=2\\) only"],
            0,
            [
                "Divide by 2: x² + 3x − 10 = 0 = (x + 5)(x − 2).",
                "x = 2 or x = −5.",
            ],
            latex="x^2+3x-10=0",
            tag="quadratic-factor",
        ),
        item(
            "brevet-alg-inq-01",
            "inequality",
            "easy",
            "Solve x − 4/3 ≥ 2/3. The solution set is:",
            ["\\(x\\ge 2\\)", "\\(x\\ge 2/3\\)", "\\(x\\le 2\\)", "\\(x\\ge -2\\)"],
            0,
            ["x ≥ 2/3 + 4/3 = 2. Trap: subtracting 4/3 from the right side only."],
            latex="x-\\frac{4}{3}\\ge\\frac{2}{3}",
            tag="linear-inequality",
        ),
        item(
            "brevet-alg-inq-02",
            "inequality",
            "easy",
            "Solve 3x − 2 < 2(x + 4). The solution set is:",
            ["\\(x<10\\)", "\\(x>10\\)", "\\(x<6\\)", "\\(x>2\\)"],
            0,
            ["3x − 2 < 2x + 8, so x < 10."],
            latex="3x-2<2(x+4)",
            tag="inequality-expand",
        ),
        item(
            "brevet-alg-inq-03",
            "inequality",
            "medium",
            "Solve 4x + 1 > 3(x − 2). The solution set is:",
            ["\\(x>-7\\)", "\\(x<-7\\)", "\\(x>7\\)", "\\(x>-1\\)"],
            0,
            ["4x + 1 > 3x − 6, so x > −7. Trap: reversing the inequality without multiplying by a negative."],
            tag="inequality-medium",
        ),
        item(
            "brevet-alg-inq-04",
            "inequality",
            "medium",
            "Solve 2(x − 3) ≤ x + 1. The solution set is:",
            ["\\(x\\le 7\\)", "\\(x\\ge 7\\)", "\\(x\\le 5\\)", "\\(x\\ge -7\\)"],
            0,
            ["2x − 6 ≤ x + 1, so x ≤ 7."],
            tag="inequality-closed",
        ),
        item(
            "brevet-alg-inq-05",
            "inequality",
            "hard",
            "Solve (2x − 1)/(x + 3) > 0, with x ≠ −3. The solution set is:",
            [
                "\\(x<-3\\) or \\(x>1/2\\)",
                "\\(-3<x<1/2\\)",
                "\\(x>1/2\\) only",
                "\\(x<-3\\) only",
            ],
            0,
            [
                "Critical values x = −3 and x = 1/2. The quotient is positive when the factors have the same sign.",
                "Both negative: x < −3. Both positive: x > 1/2.",
            ],
            latex="\\frac{2x-1}{x+3}>0",
            tag="rational-inequality",
        ),
        item(
            "brevet-alg-sys-01",
            "system",
            "easy",
            "The unique solution of the system x + y = 7 and x − y = 1 is:",
            ["\\((3,4)\\)", "\\((4,3)\\)", "\\((7,1)\\)", "\\((1,6)\\)"],
            1,
            ["Add: 2x = 8, x = 4. Then y = 3. Check: 4+3=7 and 4−3=1."],
            latex="x+y=7,\\ x-y=1",
            tag="system-add",
        ),
        item(
            "brevet-alg-sys-02",
            "system",
            "medium",
            "Solve { 2x + y = 11 ; x − y = 1 }. The solution is:",
            ["\\((4,3)\\)", "\\((3,5)\\)", "\\((5,1)\\)", "\\((2,7)\\)"],
            0,
            ["Add: 3x = 12, x = 4. Then 4 − y = 1, y = 3."],
            latex="2x+y=11,\\ x-y=1",
            tag="system-two",
        ),
        item(
            "brevet-alg-sys-03",
            "system",
            "medium",
            "Solve { x + 2y = 8 ; 3x − y = 3 }. The solution is:",
            ["\\((2,3)\\)", "\\((3,2)\\)", "\\((4,2)\\)", "\\((1,3.5)\\)"],
            0,
            [
                "From the second, y = 3x − 3. Substitute: x + 2(3x − 3) = 8 → 7x = 14 → x = 2, y = 3.",
            ],
            tag="system-substitute",
        ),
        item(
            "brevet-alg-sys-04",
            "system",
            "hard",
            "A shop sold 12 cakes: apple cakes at 1500 L.L. and lemon cakes at 2000 L.L. The total is 21 000 L.L. The number of apple cakes is:",
            ["6", "4", "8", "9"],
            0,
            [
                "x + y = 12 and 1500x + 2000y = 21000, i.e. 3x + 4y = 42.",
                "Replace y = 12 − x: 3x + 4(12 − x) = 42 → 48 − x = 42 → x = 6.",
                "Original numbers (not the 15-pies session).",
            ],
            tag="system-context",
        ),
        item(
            "brevet-alg-expn-01",
            "expression",
            "easy",
            "Write 6×10⁸ × 2.5 / (3×10⁵) in the form a × 10ⁿ with 1 ≤ |a| < 10:",
            ["\\(5\\times 10^3\\)", "\\(5\\times 10^4\\)", "\\(15\\times 10^3\\)", "\\(2\\times 10^3\\)"],
            0,
            ["(6×2.5 / 3) × 10^{8−5} = 5 × 10³."],
            latex="\\frac{6\\times 10^8\\times 2.5}{3\\times 10^5}",
            tag="scientific",
        ),
        item(
            "brevet-alg-expn-02",
            "expression",
            "medium",
            "Write (10/21) × (14/25) ÷ (2/15) as an irreducible fraction. The result is:",
            ["\\(2\\)", "\\(4/5\\)", "\\(15/7\\)", "\\(1/2\\)"],
            0,
            [
                "Division: × 15/2. Then 10/21 × 14/25 × 15/2 = 2 after cancelling 14/21 = 2/3 and 15/25 = 3/5.",
            ],
            tag="irreducible",
        ),
        item(
            "brevet-alg-expn-03",
            "expression",
            "medium",
            "For x ≠ 2, the simplified form of (3x − 6)/(x − 2) is:",
            ["3", "\\(3x\\)", "\\(x-2\\)", "1"],
            0,
            ["3(x − 2)/(x − 2) = 3 for x ≠ 2."],
            latex="\\frac{3x-6}{x-2}=3",
            tag="simplify-rational",
        ),
        item(
            "brevet-alg-expn-04",
            "expression",
            "hard",
            "Let E(x) = (x − 3)(2x + 1) + (x − 3)(x + 4). Then E(x) = 0 has solutions:",
            ["\\(x=3\\) or \\(x=-5/3\\)", "\\(x=3\\) only", "\\(x=-4\\)", "no solution"],
            0,
            ["E(x) = (x−3)(2x+1 + x+4) = (x−3)(3x+5). Roots 3 and −5/3."],
            latex="E(x)=(x-3)(3x+5)",
            tag="sum-of-products",
        ),
        item(
            "brevet-alg-expn-05",
            "expression",
            "hard",
            "Let F(x) = (3x + 1)(4x − 3) / (4x − 3) for x ≠ 3/4. Then F(x) simplifies to:",
            ["\\(3x+1\\)", "\\(4x-3\\)", "1", "\\(x\\)"],
            0,
            ["Cancel the common factor 4x − 3 (allowed because x ≠ 3/4)."],
            tag="cancel-after-factor",
        ),
        item(
            "brevet-alg-sys-05",
            "system",
            "hard",
            "The system { 2x + 3y = 12 ; 4x + 6y = 20 } has:",
            ["a unique solution", "infinitely many solutions", "no solution", "exactly two solutions"],
            2,
            [
                "The second line is twice the first except for the constant: 24 ≠ 20.",
                "Parallel lines: empty set.",
            ],
            tag="inconsistent-system",
        ),
        item(
            "brevet-alg-exp-04",
            "expand",
            "hard",
            "Expand (2x − 3)(x + 5) − (x − 1)². After reduction:",
            ["\\(x^2+11x-14\\)", "\\(x^2+9x-16\\)", "\\(2x^2+7x-14\\)", "\\(x^2+11x-16\\)"],
            0,
            [
                "(2x−3)(x+5) = 2x² + 10x − 3x − 15 = 2x² + 7x − 15.",
                "(x−1)² = x² − 2x + 1. Difference: x² + 9x − 16… wait, 2x²+7x−15 − x² +2x −1 = x² + 9x − 16.",
            ],
            tag="expand-minus-square",
        ),
    ]
)


def fix_expand_04():
    for q in ALG:
        if q["id"] == "brevet-alg-exp-04":
            q["choices"] = ["\\(x^2+9x-16\\)", "\\(x^2+11x-14\\)", "\\(2x^2+7x-14\\)", "\\(x^2+11x-16\\)"]
            q["answerIndex"] = 0
            q["answer"] = q["choices"][0]
            q["solutionSketch"] = [
                "(2x−3)(x+5) = 2x² + 7x − 15 and (x−1)² = x² − 2x + 1.",
                "Subtract: 2x² + 7x − 15 − x² + 2x − 1 = x² + 9x − 16.",
            ]
            break


fix_expand_04()


def sort_items(items, rank):
    items.sort(key=lambda q: (BAND[q["difficulty"]], rank.get(q["slice"], 9), q["id"]))
    return items


def bank(meta, slices, questions, rank):
    qs = sort_items(list(questions), rank)
    payload = {
        "id": meta["id"],
        "track": "grade-9",
        "certificate": "Brevet",
        "topic": meta["topic"],
        "title": meta["title"],
        "arabicTitle": meta["arabicTitle"],
        "contestMinutes": 20,
        "passScore": 70,
        "sourceModels": ["Grade 9 / Brevet official contests pack"],
        "styleNote": (
            "Academy-original items patterned on Lebanese Brevet sessions "
            "(الشهادة المتوسطة): official English wording, original numbers. Not photocopies of past papers."
        ),
        "slices": slices,
        "order": "easy → medium → hard",
        "contestTopics": BREVET_TOPICS,
        "nextTopicFiles": [
            "content/banks/brevet/numbers.json",
            "content/banks/brevet/word_problems.json",
            "content/banks/brevet/coordinate.json",
        ],
        "questions": qs,
    }
    return payload


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    geo = bank(
        {"id": "brevet-geometry", "topic": "geometry", "title": "Geometry", "arabicTitle": "الهندسة"},
        GEO_SLICES,
        GEO,
        GEO_RANK,
    )
    alg = bank(
        {"id": "brevet-algebra", "topic": "algebra", "title": "Algebra", "arabicTitle": "الجبر"},
        ALG_SLICES,
        ALG,
        ALG_RANK,
    )
    for payload in (geo, alg):
        path = OUT / f"{payload['topic']}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        bands = {}
        slices = {}
        ids = []
        for q in payload["questions"]:
            assert 0 <= q["answerIndex"] < len(q["choices"]), q["id"]
            assert q["choices"][q["answerIndex"]] == q["answer"]
            ids.append(q["id"])
            bands[q["difficulty"]] = bands.get(q["difficulty"], 0) + 1
            slices[q["slice"]] = slices.get(q["slice"], 0) + 1
        assert len(ids) == len(set(ids))
        print(f"{path.name}: {len(ids)} items bands={bands} slices={slices}")


if __name__ == "__main__":
    main()
