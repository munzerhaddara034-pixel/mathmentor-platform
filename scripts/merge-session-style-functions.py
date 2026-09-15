#!/usr/bin/env python3
"""Merge official-session-style analysis items into the LS Functions bank.

Existing Limits / continuity / derivatives items are kept. New items follow
patterns from LS all sessions.pdf (limits at 0/+∞, asymptotes, variation
tables, inverse functions, unique-root sandwiches) but use original functions.
They are NOT past papers.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANK = ROOT / "content/banks/g12-ls/functions.json"

SOURCE = {
    "kind": "generated-in-official-style",
    "models": ["LS all sessions.pdf"],
    "note": "Academy-original. Patterned on Lebanese Grade 12 LS session wording (limits at the bounds of I, asymptotes, table of variations, inverse). Not a photocopy of any past paper.",
}

SLICE_RANK = {
    "limits": 0,
    "continuity": 1,
    "derivatives": 2,
    "variation": 3,
    "asymptotes": 4,
    "inverse": 5,
}
BAND_RANK = {"easy": 0, "medium": 1, "hard": 2}


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


NEW = [
    # ----- limits at 0 / +∞ (official Problem-IV opening) -----
    item(
        "g12-ls-fn-an-lim-01",
        "limits",
        "easy",
        "Let f be defined on (0,+∞) by f(x)=3x ln x. Then lim_{x→0+} f(x) equals:",
        ["\\(-\\infty\\)", "\\(0\\)", "\\(1\\)", "\\(+\\infty\\)"],
        1,
        [
            "Standard: x ln x → 0 as x→0+, so 3x ln x → 0.",
            "Trap: writing −∞ because ln x → −∞, ignoring the factor x.",
        ],
        latex="f(x)=3x\\ln x\\quad (x>0)",
        tag="session-style-limit-0",
    ),
    item(
        "g12-ls-fn-an-lim-02",
        "limits",
        "easy",
        "Let f(x)=(ln x)/x on (0,+∞). Then lim_{x→+∞} f(x) equals:",
        ["\\(+\\infty\\)", "\\(1\\)", "\\(0\\)", "\\(-\\infty\\)"],
        2,
        [
            "ln x grows slower than x, so (ln x)/x → 0.",
            "Trap: +∞ because the numerator → +∞.",
        ],
        latex="\\lim_{x\\to +\\infty}\\frac{\\ln x}{x}",
        tag="session-style-limit-inf",
    ),
    item(
        "g12-ls-fn-an-lim-03",
        "limits",
        "medium",
        "Let f(x)=e^{1/x} on (0,+∞). Then lim_{x→+∞} f(x) equals:",
        ["\\(0\\)", "\\(1\\)", "e", "\\(+\\infty\\)"],
        1,
        ["1/x → 0, so e^{1/x} → e^0 = 1.", "Trap: +∞ by confusing with e^x, or 0 with e^{-x}."],
        latex="\\lim_{x\\to +\\infty}e^{1/x}",
        tag="session-style-exp-limit",
    ),
    item(
        "g12-ls-fn-an-lim-04",
        "limits",
        "medium",
        "Let f(x)=x+e^{-x}. Then lim_{x→−∞} f(x) equals:",
        ["\\(-\\infty\\)", "\\(0\\)", "\\(1\\)", "\\(+\\infty\\)"],
        3,
        [
            "As x→−∞, e^{-x}=e^{|x|} dominates and → +∞, so f(x)→+∞.",
            "Trap: −∞ from the x term alone.",
        ],
        latex="\\lim_{x\\to -\\infty}(x+e^{-x})",
        tag="session-style-exp-poly",
    ),
    item(
        "g12-ls-fn-an-lim-05",
        "limits",
        "easy",
        "Let f be defined on (0,+∞) by f(x)=e^{1/x}. Then lim_{x→0+} f(x) equals:",
        ["\\(1\\)", "\\(0\\)", "\\(+\\infty\\)", "\\(e\\)"],
        2,
        [
            "As x→0+, 1/x → +∞, hence e^{1/x} → +∞.",
            "Trap: 1, which is the limit at +∞, not at 0+.",
        ],
        latex="\\lim_{x\\to 0^+}e^{1/x}",
        tag="session-style-exp-0plus",
    ),
    # ----- asymptotes -----
    item(
        "g12-ls-fn-as-01",
        "asymptotes",
        "easy",
        "Let f(x)=(2x+1)e^{-x}. A horizontal asymptote of (C) at +∞ is:",
        ["\\(y=2x\\)", "\\(y=0\\)", "\\(y=2\\)", "\\(x=0\\)"],
        1,
        [
            "x e^{-x} → 0 and e^{-x} → 0, so f(x)→0. The line y=0 is a horizontal asymptote.",
            "Trap: keeping the linear factor y=2x.",
        ],
        latex="f(x)=(2x+1)e^{-x}",
        tag="session-style-horizontal",
    ),
    item(
        "g12-ls-fn-as-02",
        "asymptotes",
        "easy",
        "Let f(x)=(ln x)/x on (0,+∞). As x→0+, f(x)→−∞. Graphically:",
        [
            "y=0 is a horizontal asymptote at 0",
            "the y-axis (x=0) is a vertical asymptote of (C)",
            "y=x is an asymptote",
            "no asymptote",
        ],
        1,
        [
            "ln x → −∞ faster than x → 0+, so f → −∞. The line x=0 is a vertical asymptote.",
            "This is the usual graphical interpretation asked after lim_{x→0+} f(x).",
        ],
        latex="f(x)=\\frac{\\ln x}{x}",
        tag="session-style-vertical",
    ),
    item(
        "g12-ls-fn-as-03",
        "asymptotes",
        "medium",
        "Let f(x)=x+e^{-x} and (C) its curve. The line y=x is an asymptote of (C) at +∞ because:",
        [
            "lim f(x)=+∞",
            "lim_{x→+∞}(f(x)−x)=0",
            "f'(x)→1",
            "f(0)=1",
        ],
        1,
        [
            "Official wording: prove y=x is an asymptote by showing lim (f(x)−x)=0.",
            "Here f(x)−x=e^{-x}→0. lim f=+∞ alone does not give the asymptote y=x.",
        ],
        latex="\\lim_{x\\to +\\infty}\\bigl(f(x)-x\\bigr)=0",
        tag="session-style-oblique-x",
    ),
    item(
        "g12-ls-fn-as-04",
        "asymptotes",
        "medium",
        "Let f(x)=x+3−2e^{-x}. An asymptote of (C) at +∞ is:",
        ["\\(y=x\\)", "\\(y=x+3\\)", "\\(y=3\\)", "\\(y=x-2\\)"],
        1,
        [
            "f(x)−(x+3)=−2e^{-x}→0, so y=x+3 is an asymptote at +∞.",
            "Trap: y=x (forgetting the constant) or y=x−2 (copying a different session).",
        ],
        latex="f(x)=x+3-2e^{-x}",
        tag="session-style-oblique-shift",
    ),
    item(
        "g12-ls-fn-as-05",
        "asymptotes",
        "hard",
        "Let f(x)=x+(ln x)/x on (0,+∞), and (d): y=x. The relative position of (C) and (d) is:",
        [
            "(C) is above (d) for all x>0",
            "(C) is above (d) iff x>1, and below iff 0<x<1",
            "(C) coincides with (d)",
            "(C) is below (d) for x>1",
        ],
        1,
        [
            "f(x)−x=(ln x)/x. The denominator x>0, so the sign is the sign of ln x.",
            "C above d on (1,+∞); C below d on (0,1). They meet at x=1.",
        ],
        latex="f(x)-x=\\frac{\\ln x}{x}",
        tag="session-style-position",
    ),
    # ----- variation tables -----
    item(
        "g12-ls-fn-var-01",
        "variation",
        "easy",
        "The table of f' shows f'(x)>0 for every x in I. Then on I the function f is:",
        ["strictly decreasing", "strictly increasing", "constant", "not monotonic"],
        1,
        [
            "If f'>0 on an interval, f is strictly increasing. This sentence is how LS sessions justify the inverse later.",
        ],
        tag="session-style-variation-sign",
    ),
    item(
        "g12-ls-fn-var-02",
        "variation",
        "medium",
        "Let f(x)=3x ln x on (0,+∞). Then f'(x)=3(ln x+1). The table of variations of f is:",
        [
            "decreasing on (0,+∞)",
            "decreasing on (0,1/e] and increasing on [1/e,+∞)",
            "increasing on (0,1/e] and decreasing on [1/e,+∞)",
            "increasing on (0,+∞)",
        ],
        1,
        [
            "f'(x)=0 at ln x=−1, i.e. x=1/e. f'<0 on (0,1/e) and f'>0 on (1/e,+∞).",
            "Minimum value f(1/e)=−3/e. Trap: swapping the two arrows.",
        ],
        latex="f'(x)=3(\\ln x+1)",
        tag="session-style-variation-ln",
    ),
    item(
        "g12-ls-fn-var-03",
        "variation",
        "medium",
        "Let f(x)=x ln x − x on (0,+∞). The minimum of f is attained at:",
        ["\\(x=e\\)", "\\(x=1\\), and f(1)=−1", "\\(x=0\\)", "no minimum"],
        1,
        [
            "f'(x)=ln x. Critical point x=1, and f' changes − to +. Minimum f(1)=−1.",
            "Trap: x=e from confusing with (ln x)/x.",
        ],
        latex="f(x)=x\\ln x-x",
        tag="session-style-extremum",
    ),
    item(
        "g12-ls-fn-var-04",
        "variation",
        "hard",
        "Suppose f'(x)=2(1−ln x)/x^2 on (0,+∞). Then f is:",
        [
            "increasing on (0,+∞)",
            "increasing on (0,e] and decreasing on [e,+∞)",
            "decreasing on (0,e] and increasing on [e,+∞)",
            "decreasing on (0,+∞)",
        ],
        1,
        [
            "x^2>0, so the sign of f' is the sign of 1−ln x, i.e. f'>0 iff x<e.",
            "Official sessions often give f' already factored and ask only for the table of f.",
        ],
        latex="f'(x)=\\frac{2(1-\\ln x)}{x^2}",
        tag="session-style-given-fprime",
    ),
    item(
        "g12-ls-fn-var-06",
        "variation",
        "medium",
        "Let f(x)=(2x+1)e^{-x}. Then f'(x)=(1-2x)e^{-x}. The table of variations of f is:",
        [
            "increasing on ℝ",
            "increasing on (−∞,1/2] and decreasing on [1/2,+∞)",
            "decreasing on (−∞,1/2] and increasing on [1/2,+∞)",
            "decreasing on ℝ",
        ],
        1,
        [
            "e^{-x}>0, so the sign of f' is the sign of 1−2x. Critical point x=1/2.",
            "Maximum f(1/2)=2e^{-1/2}. Trap: swapping the two arrows.",
        ],
        latex="f'(x)=(1-2x)e^{-x}",
        tag="session-style-variation-exp-product",
    ),
    item(
        "g12-ls-fn-var-05",
        "variation",
        "hard",
        "The table of variations of f' shows f' decreasing on (0,e) with f'(e)=0 and f' increasing after, with f'(x)>0 on (0,+∞). Then (C) has:",
        [
            "no inflection and f is not monotonic",
            "an inflection point at x=e, and f is strictly increasing on (0,+∞)",
            "a local maximum at x=e",
            "a vertical asymptote at x=e",
        ],
        1,
        [
            "f' changes from decreasing to increasing at e, so f'' changes sign: inflection at x=e.",
            "f' stays positive, so f remains strictly increasing. Trap: treating a zero of f' as a max of f.",
        ],
        tag="session-style-inflection-from-table",
    ),
    # ----- inverse -----
    item(
        "g12-ls-fn-inv-01",
        "inverse",
        "easy",
        "On an interval I, f is continuous and strictly increasing. Then:",
        [
            "f has no inverse",
            "f admits an inverse function on I",
            "f' > 0 is still required as an extra hypothesis",
            "the inverse is f itself",
        ],
        1,
        [
            "This is the exact justification used in LS sessions: continuous and strictly monotonic ⇒ inverse exists.",
            "f'>0 is sufficient but not necessary (f' may vanish at isolated points).",
        ],
        tag="session-style-inverse-existence",
    ),
    item(
        "g12-ls-fn-inv-02",
        "inverse",
        "medium",
        "Let f(x)=e^{2x} on ℝ. The inverse function g satisfies:",
        ["\\(g(x)=2\\ln x\\) on ℝ", "\\(g(x)=\\frac12\\ln x\\) on (0,+∞)", "\\(g(x)=e^{x/2}\\)", "\\(g(x)=\\ln(2x)\\)"],
        1,
        [
            "Range of f is (0,+∞). y=e^{2x} ⇒ x=(1/2) ln y.",
            "Trap: forgetting the factor 1/2 or the domain (0,+∞).",
        ],
        latex="f(x)=e^{2x}",
        tag="session-style-inverse-formula",
    ),
    item(
        "g12-ls-fn-inv-03",
        "inverse",
        "medium",
        "Let f(x)=e^{1/x} on (0,+∞). Then f admits an inverse g defined on:",
        ["\\((0,+\\infty)\\)", "\\((1,+\\infty)\\), and g(x)=1/\\ln x", "\\(\\mathbb{R}\\)", "\\([0,1]\\)"],
        1,
        [
            "f' < 0, so f is strictly decreasing from +∞ to 1. Range (1,+∞).",
            "y=e^{1/x} ⇒ x=1/ln y. Trap: domain (0,+∞) copying the domain of f.",
        ],
        latex="f(x)=e^{1/x}\\quad (x>0)",
        tag="session-style-inverse-exp",
    ),
    item(
        "g12-ls-fn-inv-04",
        "inverse",
        "hard",
        "Let f(x)=x+e^{-x}. On ℝ, f:",
        [
            "admits an inverse because lim_{±∞} f=±∞",
            "does not admit an inverse on ℝ (not injective: global minimum at 0)",
            "admits an inverse because f' exists",
            "is a bijection from ℝ onto ℝ",
        ],
        1,
        [
            "f'(x)=1−e^{-x} vanishes at 0 and changes − to +. Minimum f(0)=1. f(−1)=f(a) for some a>0.",
            "On [0,+∞) one may restrict and obtain an inverse onto [1,+∞). The session always specifies the interval.",
        ],
        latex="f(x)=x+e^{-x}",
        tag="session-style-inverse-restrict",
    ),
    item(
        "g12-ls-fn-inv-05",
        "inverse",
        "hard",
        "Let f(x)=x+e^{-x} on [0,+∞). Then f admits an inverse g defined on:",
        ["\\([0,+\\infty)\\)", "\\([1,+\\infty)\\)", "\\(\\mathbb{R}\\)", "\\((0,1)\\)"],
        1,
        [
            "On [0,+∞), f'=1−e^{-x}≥0 and f is strictly increasing, f(0)=1, lim_{+∞}=+∞.",
            "So g is defined on [1,+∞). Trap: copying the domain of f.",
        ],
        latex="f:[0,+\\infty)\\to[1,+\\infty)",
        tag="session-style-inverse-domain",
    ),
    item(
        "g12-ls-fn-inv-06",
        "inverse",
        "easy",
        "Let f(x)=x+3−2e^{-x} on ℝ. Then f admits an inverse on ℝ because:",
        [
            "lim_{x→+∞} f(x)=+∞ is enough",
            "f'(x)=1+2e^{-x}>0, so f is continuous and strictly increasing on ℝ",
            "f is a polynomial",
            "f(0)=1",
        ],
        1,
        [
            "Session justification: continuous and strictly monotonic on I ⇒ inverse on I.",
            "Here f'=1+2e^{-x} never vanishes. Trap: using only a limit at +∞.",
        ],
        latex="f'(x)=1+2e^{-x}>0",
        tag="session-style-inverse-strict",
    ),
    # ----- tangent / unique root (closing of Problem IV) -----
    item(
        "g12-ls-fn-an-tan-01",
        "derivatives",
        "medium",
        "Let f(x)=x+e^{-x}. An equation of the tangent to (C) at the point of abscissa 0 is:",
        ["\\(y=x+1\\)", "\\(y=1\\)", "\\(y=x\\)", "\\(y=e^{-x}\\)"],
        1,
        [
            "f(0)=1 and f'(0)=1−1=0, so the tangent is the horizontal line y=1.",
            "Trap: y=x+1 using slope 1 (that is f' at +∞, not at 0).",
        ],
        latex="f(0)=1,\\ f'(0)=0",
        tag="session-style-tangent",
    ),
    item(
        "g12-ls-fn-an-tan-02",
        "derivatives",
        "medium",
        "Let f(x)=3x ln x. An equation of the tangent to (C) at the point of abscissa 1 is:",
        ["\\(y=0\\)", "\\(y=3x\\)", "\\(y=3(x-1)\\)", "\\(y=x-1\\)"],
        2,
        [
            "f(1)=0, f'(1)=3(0+1)=3, so y−0=3(x−1).",
            "Trap: y=3x (not through (1,0)).",
        ],
        latex="f(1)=0,\\ f'(1)=3",
        tag="session-style-tangent-ln",
    ),
    item(
        "g12-ls-fn-an-root-01",
        "variation",
        "hard",
        "Let f(x)=x+e^{-x}−2 on [0,+∞). The equation f(x)=0 has a unique root α, and:",
        ["\\(0<\\alpha<1\\)", "\\(1.8<\\alpha<1.9\\)", "\\(\\alpha=2\\)", "no root"],
        1,
        [
            "f'(x)=1−e^{-x}≥0 on [0,+∞), so f is strictly increasing: at most one root.",
            "f(1.8)≈−0.035<0 and f(1.9)≈0.050>0, hence 1.8<α<1.9 (session sandwich).",
        ],
        latex="f(x)=x+e^{-x}-2",
        tag="session-style-root-sandwich",
    ),
]


def main() -> None:
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    existing_ids = {q["id"] for q in bank["questions"]}
    added = [q for q in NEW if q["id"] not in existing_ids]
    questions = list(bank["questions"]) + added
    questions.sort(key=lambda q: (BAND_RANK[q["difficulty"]], SLICE_RANK.get(q["slice"], 9), q["id"]))
    out = {
        "id": bank["id"],
        "track": bank["track"],
        "certificate": bank["certificate"],
        "topic": bank["topic"],
        "title": bank["title"],
        "arabicTitle": bank["arabicTitle"],
        "lessonId": bank.get("lessonId", "grade-12-ch1"),
        "contestMinutes": bank.get("contestMinutes", 25),
        "passScore": bank.get("passScore", 70),
        "sourceModels": bank.get("sourceModels") or ["LS all sessions.pdf"],
        "styleNote": (
            "Academy-original items patterned on Lebanese Grade 12 LS official sessions "
            "(LS all sessions.pdf): Problem IV wording — limits at the bounds of I, "
            "vertical/horizontal/oblique asymptotes, table of variations, inverse on an interval, "
            "tangent, unique root with a numerical sandwich. Not photocopies of past papers."
        ),
        "slices": [
            {"id": "limits", "title": "Limits", "arabicTitle": "النهايات", "note": "First slice. Classroom video + notes: /classroom/grade-12-ch1."},
            {"id": "continuity", "title": "Continuity", "arabicTitle": "الاستمرار"},
            {"id": "derivatives", "title": "Derivatives", "arabicTitle": "المشتقات"},
            {"id": "variation", "title": "Table of variations", "arabicTitle": "جدول التغيرات"},
            {"id": "asymptotes", "title": "Asymptotes", "arabicTitle": "خطوط التقارب"},
            {"id": "inverse", "title": "Inverse functions", "arabicTitle": "الدوال العكسية"},
        ],
        "order": "easy → medium → hard (within a band: limits, continuity, derivatives, variation, asymptotes, inverse)",
        "contestTopics": [
            {
                "id": "mcq-mixed",
                "file": None,
                "title": "I · Mixed MCQ",
                "arabicTitle": "أولاً · أسئلة مختلطة",
                "note": "Short mixed items (often ~2.5 pts). Not a separate bank file yet.",
                "implemented": False,
            },
            {
                "id": "space-geometry",
                "file": "content/banks/g12-ls/space-geometry.json",
                "title": "II · Space geometry",
                "arabicTitle": "ثانياً · هندسة الفضاء",
                "implemented": False,
            },
            {
                "id": "probability",
                "file": "content/banks/g12-ls/probability.json",
                "title": "III · Probability",
                "arabicTitle": "ثالثاً · الاحتمالات",
                "implemented": False,
            },
            {
                "id": "functions",
                "file": "content/banks/g12-ls/functions.json",
                "title": "IV · Functions analysis (this bank)",
                "arabicTitle": "رابعاً · دراسة الدوال",
                "implemented": True,
            },
        ],
        "nextTopicFiles": [
            "content/banks/g12-ls/space-geometry.json",
            "content/banks/g12-ls/probability.json",
            "content/banks/g12-ls/integration.json",
        ],
        "questions": questions,
    }
    BANK.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    bank = out
    bands: dict[str, int] = {}
    slices: dict[str, int] = {}
    for q in bank["questions"]:
        bands[q["difficulty"]] = bands.get(q["difficulty"], 0) + 1
        slices[q["slice"]] = slices.get(q["slice"], 0) + 1
    print(f"Wrote {BANK.name}: {len(bank['questions'])} items (+{len(added)} new) bands={bands} slices={slices}")


if __name__ == "__main__":
    main()
