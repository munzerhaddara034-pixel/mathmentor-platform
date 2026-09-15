#!/usr/bin/env python3
"""Seed missing exam-engine topics: sequences, LH track, extra DE items.

These are academy-original, tagged generated-in-official-style.
They are NOT past papers. Fewer than 30 items is intentional (scaffold).
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANKS = ROOT / "content/banks"

STYLE_NOTE = (
    "Academy-original items patterned on Lebanese official-session wording. "
    "Practice in official style — not photocopies of past papers."
)

SESSIONS = [
    (2023, "ordinary"),
    (2023, "extraordinary"),
    (2024, "ordinary"),
    (2024, "extraordinary"),
    (2025, "ordinary"),
    (2025, "extraordinary"),
]


def source(models: list[str], tag: str) -> dict:
    return {
        "kind": "generated-in-official-style",
        "models": models,
        "note": STYLE_NOTE,
        "tag": tag,
    }


def item(
    qid: str,
    slice_id: str,
    difficulty: str,
    stem: str,
    choices: list[str],
    answer_index: int,
    sketch: list[str],
    models: list[str],
    *,
    latex: str | None = None,
    tag: str = "",
    bareme: int | None = None,
    index: int = 0,
) -> dict:
    year, session = SESSIONS[index % len(SESSIONS)]
    pts = bareme if bareme is not None else {"easy": 1, "medium": 2, "hard": 3}[difficulty]
    row = {
        "id": qid,
        "slice": slice_id,
        "difficulty": difficulty,
        "source": source(models, tag or slice_id),
        "stem": stem,
        "choices": choices,
        "answerIndex": answer_index,
        "answer": choices[answer_index],
        "solutionSketch": sketch,
        "bareme": pts,
        "styleYear": year,
        "session": session,
        "styleTag": f"style:official-{year}-{session}",
        "verbatimPastPaper": False,
    }
    if latex:
        row["latex"] = latex
    return row


def dump(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  {path.relative_to(ROOT)}  ({len(payload['questions'])} items)")


def bank(
    *,
    bank_id: str,
    certificate: str,
    topic: str,
    title: str,
    arabic_title: str,
    models: list[str],
    slices: list[dict],
    questions: list[dict],
    contest_minutes: int = 20,
    track: str = "grade-12",
    contest_topics: list[dict] | None = None,
) -> dict:
    return {
        "id": bank_id,
        "track": track,
        "certificate": certificate,
        "topic": topic,
        "title": title,
        "arabicTitle": arabic_title,
        "contestMinutes": contest_minutes,
        "passScore": 50,
        "sourceModels": models,
        "styleNote": STYLE_NOTE,
        "verbatimPastPaper": False,
        "slices": slices,
        "order": "easy → medium → hard",
        "contestTopics": contest_topics or [],
        "questions": questions,
    }


LH_TOPICS = [
    {
        "id": "functions",
        "file": "content/banks/g12-lh/functions.json",
        "title": "I · Functions",
        "arabicTitle": "أولاً · الدوال",
        "implemented": True,
    },
    {
        "id": "sequences",
        "file": "content/banks/g12-lh/sequences.json",
        "title": "II · Sequences",
        "arabicTitle": "ثانياً · المتتاليات",
        "implemented": True,
    },
    {
        "id": "probability",
        "file": "content/banks/g12-lh/probability.json",
        "title": "III · Probability",
        "arabicTitle": "ثالثاً · الاحتمالات",
        "implemented": True,
    },
]


def sequences_ls() -> list[dict]:
    m = ["LS all sessions.pdf"]
    Q = []
    Q.append(item("g12-ls-seq-01", "arith", "easy",
        "The sequence defined by u_n = 3n − 1 is arithmetic. Its common difference is:",
        [r"\(3\)", r"\(2\)", r"\(-1\)", r"\(3n\)"], 0,
        ["u_{n+1} − u_n = 3(n+1)−1 − (3n−1) = 3.", "Common difference d = 3."],
        m, latex=r"u_n=3n-1", tag="arith-d", index=0, bareme=1))
    Q.append(item("g12-ls-seq-02", "geo", "easy",
        "The sequence v_n = 2·(1/2)^n is geometric. Its common ratio is:",
        [r"\(2\)", r"\(1/2\)", r"\(-1/2\)", r"\(1\)"], 1,
        ["v_{n+1}/v_n = (1/2)^{n+1}/(1/2)^n = 1/2.", "Ratio q = 1/2."],
        m, latex=r"v_n=2\cdot(1/2)^n", tag="geo-q", index=1, bareme=1))
    Q.append(item("g12-ls-seq-03", "limit", "easy",
        "Let u_n = (2n+1)/(n+4). Then lim_{n→∞} u_n equals:",
        [r"\(0\)", r"\(1/4\)", r"\(2\)", r"\(+\infty\)"], 2,
        ["Divide by n: (2+1/n)/(1+4/n) → 2/1 = 2."],
        m, latex=r"u_n=\frac{2n+1}{n+4}", tag="rat-lim", index=2, bareme=1))
    Q.append(item("g12-ls-seq-04", "recur", "medium",
        "u_0=1 and u_{n+1}=2u_n+1. Then u_1 and u_2 are:",
        [r"\(2\) then \(5\)", r"\(3\) then \(7\)", r"\(1\) then \(3\)", r"\(3\) then \(5\)"], 1,
        ["u_1=2·1+1=3.", "u_2=2·3+1=7."],
        m, latex=r"u_{n+1}=2u_n+1,\ u_0=1", tag="linear-recur", index=3, bareme=2))
    Q.append(item("g12-ls-seq-05", "closed", "medium",
        "The closed form of u_{n+1}=2u_n+1, u_0=1 is u_n=2^{n+1}−1. Then u_3 equals:",
        [r"\(7\)", r"\(15\)", r"\(8\)", r"\(16\)"], 1,
        ["u_3=2^{4}−1=16−1=15.", "Check: 1, 3, 7, 15."],
        m, latex=r"u_n=2^{n+1}-1", tag="closed-form", index=4, bareme=2))
    Q.append(item("g12-ls-seq-06", "sum", "medium",
        "The sum S_n=1+2+…+n equals n(n+1)/2. Then S_10 equals:",
        [r"\(45\)", r"\(55\)", r"\(100\)", r"\(110\)"], 1,
        ["10·11/2=55."],
        m, latex=r"S_n=\frac{n(n+1)}{2}", tag="arith-sum", index=5, bareme=2))
    Q.append(item("g12-ls-seq-07", "limit", "hard",
        "u_{n+1}=√(2+u_n), u_0=0. The sequence increases and is bounded by 2, so it converges to ℓ with ℓ=√(2+ℓ). Then ℓ equals:",
        [r"\(1\)", r"\(√2\)", r"\(2\)", r"\(-1\)"], 2,
        ["ℓ²=2+ℓ ⇒ ℓ²−ℓ−2=0 ⇒ (ℓ−2)(ℓ+1)=0.", "ℓ≥0 so ℓ=2."],
        m, latex=r"u_{n+1}=\sqrt{2+u_n}", tag="nested-sqrt", index=0, bareme=3))
    Q.append(item("g12-ls-seq-08", "geo", "hard",
        "The infinite geometric sum ∑_{k=0}^{∞} (1/3)^k equals:",
        [r"\(1/3\)", r"\(1/2\)", r"\(3/2\)", r"\(3\)"], 2,
        ["|q|<1 so sum=1/(1−q)=1/(1−1/3)=3/2."],
        m, latex=r"\sum_{k=0}^{\infty}(1/3)^k", tag="geo-series", index=1, bareme=3))
    return Q


def sequences_gs() -> list[dict]:
    m = ["GS-All.pdf"]
    Q = []
    Q.append(item("g12-gs-seq-01", "arith", "easy",
        "u_n=7−2n is arithmetic. u_0 and the common difference are:",
        [r"\(7\) and \(-2\)", r"\(7\) and \(2\)", r"\(-2\) and \(7\)", r"\(5\) and \(-2\)"], 0,
        ["u_0=7.", "d=u_{n+1}−u_n=−2."],
        m, latex=r"u_n=7-2n", tag="arith", index=2, bareme=1))
    Q.append(item("g12-gs-seq-02", "limit", "easy",
        "lim_{n→∞} n/(n²+1) equals:",
        [r"\(1\)", r"\(0\)", r"\(+\infty\)", r"\(1/2\)"], 1,
        ["Divide by n²: (1/n)/(1+1/n²) → 0."],
        m, latex=r"\frac{n}{n^2+1}", tag="rat-0", index=3, bareme=1))
    Q.append(item("g12-gs-seq-03", "recur", "medium",
        "u_{n+1}=(1/2)u_n+1, u_0=0. The fixed point ℓ=(1/2)ℓ+1 is:",
        [r"\(1\)", r"\(2\)", r"\(1/2\)", r"\(0\)"], 1,
        ["ℓ/2=1 so ℓ=2."],
        m, latex=r"u_{n+1}=\frac12 u_n+1", tag="fixed-pt", index=4, bareme=2))
    Q.append(item("g12-gs-seq-04", "closed", "medium",
        "Set v_n=u_n−2 for u_{n+1}=(1/2)u_n+1, u_0=0. Then v_n=−2·(1/2)^n, so u_4 equals:",
        [r"\(1\)", r"\(1.5\)", r"\(1.875\)", r"\(2\)"], 2,
        ["v_4=−2/16=−1/8.", "u_4=2−1/8=15/8=1.875."],
        m, latex=r"u_n=2-2\cdot(1/2)^n", tag="affine-closed", index=5, bareme=2))
    Q.append(item("g12-gs-seq-05", "mono", "hard",
        "u_0=1, u_{n+1}=u_n/(1+u_n). Then (u_n) is positive, decreasing, and lim u_n equals:",
        [r"\(1\)", r"\(1/2\)", r"\(0\)", r"\(+\infty\)"], 2,
        ["If ℓ=ℓ/(1+ℓ) then ℓ²=0 so ℓ=0.", "u_{n+1}<u_n because 1/(1+u_n)<1."],
        m, latex=r"u_{n+1}=\frac{u_n}{1+u_n}", tag="reciprocal-type", index=0, bareme=3))
    Q.append(item("g12-gs-seq-06", "complex-seq", "hard",
        "The sequence z_n=(1+i)^n / 2^{n/2} in C has modulus:",
        [r"\(1\)", r"\(√2\)", r"\(2^{n/2}\)", r"\(0\)"], 0,
        ["|1+i|=√2, so |z_n|=(√2)^n / 2^{n/2}=1."],
        m, latex=r"z_n=\frac{(1+i)^n}{2^{n/2}}", tag="mod-1", index=1, bareme=3))
    Q.append(item("g12-gs-seq-07", "sum", "medium",
        "∑_{k=1}^{n} (1/2)^k = 1 − (1/2)^n. As n→∞ the sum tends to:",
        [r"\(0\)", r"\(1/2\)", r"\(1\)", r"\(2\)"], 2,
        ["Geometric: q=1/2, first term 1/2, infinite sum=1."],
        m, latex=r"\sum_{k=1}^{n}(1/2)^k", tag="partial-geo", index=2, bareme=2))
    Q.append(item("g12-gs-seq-08", "limit", "easy",
        "lim_{n→∞} (1+1/n)^n equals e. A numerical sandwich around e is closest to:",
        [r"\(2.0\)", r"\(2.7\)", r"\(3.5\)", r"\(1.5\)"], 1,
        ["e≈2.718 so 2.7 is the listed neighbour."],
        m, latex=r"\left(1+\frac1n\right)^n", tag="e-limit", index=3, bareme=1))
    return Q


def sequences_se() -> list[dict]:
    m = ["SE_All Sessions.pdf"]
    Q = []
    Q.append(item("g12-se-seq-01", "finance", "easy",
        "A capital C is multiplied by 1.05 each year. After n years it equals:",
        [r"\(C+1.05n\)", r"\(C(1.05)^n\)", r"\(C^{1.05n}\)", r"\(1.05C+n\)"], 1,
        ["Geometric growth with ratio 1.05."],
        m, latex=r"C(1.05)^n", tag="compound", index=4, bareme=1))
    Q.append(item("g12-se-seq-02", "arith", "easy",
        "A salary starts at 800 and increases by 40 each year. Year n (n starting at 0) is:",
        [r"\(800·40^n\)", r"\(800+40n\)", r"\(840n\)", r"\(800/40n\)"], 1,
        ["Arithmetic sequence: u_n=800+40n."],
        m, latex=r"u_n=800+40n", tag="salary", index=5, bareme=1))
    Q.append(item("g12-se-seq-03", "limit", "medium",
        "u_n=100(0.8)^n is a decaying geometric sequence. lim u_n equals:",
        [r"\(100\)", r"\(80\)", r"\(0\)", r"\(+\infty\)"], 2,
        ["|q|=0.8<1 so q^n→0."],
        m, latex=r"u_n=100(0.8)^n", tag="decay", index=0, bareme=2))
    Q.append(item("g12-se-seq-04", "sum", "medium",
        "The present value of a perpetuity of 1 each year at rate 10% is ∑_{k=1}^{∞} 1/(1.1)^k which equals:",
        [r"\(1\)", r"\(10\)", r"\(11\)", r"\(0.1\)"], 1,
        ["First term a=1/1.1, ratio q=1/1.1, sum=a/(1−q)=10."],
        m, latex=r"\sum_{k=1}^{\infty}(1.1)^{-k}", tag="perpetuity", index=1, bareme=2))
    Q.append(item("g12-se-seq-05", "closed", "hard",
        "Inventory: u_{n+1}=0.6 u_n + 20, u_0=100. The equilibrium stock is:",
        [r"\(20\)", r"\(32\)", r"\(50\)", r"\(100\)"], 2,
        ["ℓ=0.6ℓ+20 ⇒ 0.4ℓ=20 ⇒ ℓ=50."],
        m, latex=r"u_{n+1}=0.6u_n+20", tag="stock", index=2, bareme=3))
    Q.append(item("g12-se-seq-06", "geo", "hard",
        "An investment of 1000 grows 8% per year. The smallest integer n with 1000(1.08)^n ≥ 2000 is the smallest n satisfying (1.08)^n≥2. Since ln2/ln(1.08)≈9.01, that n equals:",
        [r"\(8\)", r"\(9\)", r"\(10\)", r"\(12\)"], 2,
        ["ln2/ln(1.08)≈9.01 so n=10 because (1.08)^9≈1.999<2 and (1.08)^10>2."],
        m, latex=r"1000(1.08)^n\ge 2000", tag="doubling", index=3, bareme=3))
    Q.append(item("g12-se-seq-07", "arith", "medium",
        "The 5th term of 12, 15, 18, … is:",
        [r"\(21\)", r"\(24\)", r"\(27\)", r"\(30\)"], 1,
        ["d=3, u_5=12+4·3=24 (if first term is u_1)."],
        m, latex=r"u_n=12+3(n-1)", tag="nth-term", index=4, bareme=2))
    Q.append(item("g12-se-seq-08", "limit", "easy",
        "A price index u_n=200 + 30/n. As n→∞ the index tends to:",
        [r"\(0\)", r"\(30\)", r"\(200\)", r"\(+\infty\)"], 2,
        ["30/n→0 so limit 200."],
        m, latex=r"u_n=200+\frac{30}{n}", tag="index", index=5, bareme=1))
    return Q


def sequences_lh() -> list[dict]:
    m = ["LH official-style scaffold"]
    Q = []
    Q.append(item("g12-lh-seq-01", "arith", "easy",
        "The sequence 5, 8, 11, 14, … is arithmetic with difference:",
        [r"\(2\)", r"\(3\)", r"\(5\)", r"\(8\)"], 1,
        ["8−5=3."],
        m, latex=r"u_n=5+3(n-1)", tag="d", index=0, bareme=1))
    Q.append(item("g12-lh-seq-02", "geo", "easy",
        "2, 6, 18, 54, … is geometric with ratio:",
        [r"\(2\)", r"\(3\)", r"\(4\)", r"\(6\)"], 1,
        ["6/2=3."],
        m, latex=r"u_n=2\cdot 3^{n-1}", tag="q", index=1, bareme=1))
    Q.append(item("g12-lh-seq-03", "limit", "easy",
        "u_n=1/n. Then lim_{n→∞} u_n equals:",
        [r"\(1\)", r"\(0\)", r"\(+\infty\)", r"\(-1\)"], 1,
        ["Standard limit 1/n → 0."],
        m, latex=r"u_n=\frac1n", tag="harm", index=2, bareme=1))
    Q.append(item("g12-lh-seq-04", "recur", "medium",
        "u_0=4, u_{n+1}=u_n/2. Then u_3 equals:",
        [r"\(2\)", r"\(1\)", r"\(0.5\)", r"\(0\)"], 2,
        ["4, 2, 1, 0.5."],
        m, latex=r"u_{n+1}=u_n/2", tag="halving", index=3, bareme=2))
    Q.append(item("g12-lh-seq-05", "sum", "medium",
        "1+3+5+7+9 equals:",
        [r"\(20\)", r"\(25\)", r"\(30\)", r"\(15\)"], 1,
        ["Five odd numbers: 5²=25."],
        m, latex=r"\sum_{k=1}^{5}(2k-1)", tag="odd-sum", index=4, bareme=2))
    Q.append(item("g12-lh-seq-06", "limit", "hard",
        "u_n=(n+1)/(n+3). lim u_n equals:",
        [r"\(0\)", r"\(1/3\)", r"\(1\)", r"\(+\infty\)"], 2,
        ["(1+1/n)/(1+3/n) → 1."],
        m, latex=r"u_n=\frac{n+1}{n+3}", tag="rat-1", index=5, bareme=3))
    Q.append(item("g12-lh-seq-07", "geo", "hard",
        "∑_{k=0}^{∞} (1/4)^k equals:",
        [r"\(1/4\)", r"\(1/3\)", r"\(4/3\)", r"\(4\)"], 2,
        ["1/(1−1/4)=4/3."],
        m, latex=r"\sum_{k=0}^{\infty}(1/4)^k", tag="geo-inf", index=0, bareme=3))
    Q.append(item("g12-lh-seq-08", "closed", "medium",
        "u_n=2n+1. The 10th term (n starting at 1) is:",
        [r"\(19\)", r"\(21\)", r"\(20\)", r"\(11\)"], 1,
        ["u_10=20+1=21."],
        m, latex=r"u_n=2n+1", tag="nth", index=1, bareme=2))
    return Q


def functions_lh() -> list[dict]:
    m = ["LH official-style scaffold"]
    Q = []
    Q.append(item("g12-lh-fn-01", "poly", "easy",
        "The derivative of f(x)=x²−4x+1 is:",
        [r"\(2x-4\)", r"\(x-4\)", r"\(2x+1\)", r"\(x^2-4\)"], 0,
        ["Term by term: 2x−4."],
        m, latex=r"f(x)=x^2-4x+1", tag="poly-der", index=2, bareme=1))
    Q.append(item("g12-lh-fn-02", "sign", "easy",
        "f'(x)=2x−4 vanishes at x=2. f decreases on:",
        [r"\(]2,+\infty[\)", r"\(]-\infty,2]\)", r"\(\mathbb{R}\)", r"\(\emptyset\)"], 1,
        ["f'(x)≤0 on ]−∞,2]."],
        m, latex=r"f'(x)=2x-4", tag="var-table", index=3, bareme=1))
    Q.append(item("g12-lh-fn-03", "limit", "easy",
        "lim_{x→+∞} (3x+1)/(x+2) equals:",
        [r"\(0\)", r"\(1/2\)", r"\(3\)", r"\(+\infty\)"], 2,
        ["Dominant terms 3x/x=3."],
        m, latex=r"\lim_{x\to+\infty}\frac{3x+1}{x+2}", tag="rat-lim", index=4, bareme=1))
    Q.append(item("g12-lh-fn-04", "ln", "medium",
        "The derivative of ln(x+1) on ]−1,+∞[ is:",
        [r"\(1/x\)", r"\(1/(x+1)\)", r"\(x+1\)", r"\(1/(x+1)^2\)"], 1,
        ["(ln u)'=u'/u with u=x+1."],
        m, latex=r"(\ln(x+1))'", tag="ln-der", index=5, bareme=2))
    Q.append(item("g12-lh-fn-05", "exp", "medium",
        "lim_{x→−∞} e^x equals:",
        [r"\(0\)", r"\(1\)", r"\(+\infty\)", r"\(-1\)"], 0,
        ["Exponential vanishes at −∞."],
        m, latex=r"\lim_{x\to-\infty}e^x", tag="exp-0", index=0, bareme=2))
    Q.append(item("g12-lh-fn-06", "tangent", "hard",
        "The tangent to y=x² at x=1 has slope 2 and equation:",
        [r"\(y=2x\)", r"\(y=2x-1\)", r"\(y=x-1\)", r"\(y=2x+1\)"], 1,
        ["y−1=2(x−1) ⇒ y=2x−1."],
        m, latex=r"y=x^2\ \text{at }x=1", tag="tangent", index=1, bareme=3))
    Q.append(item("g12-lh-fn-07", "root", "hard",
        "f(x)=x³−x−1 satisfies f(1)=−1<0 and f(2)=5>0. By IVT there is a root in:",
        [r"\(]0,1[\)", r"\(]1,2[\)", r"\(]2,3[\)", r"\(]−1,0[\)"], 1,
        ["Continuous on [1,2] with a sign change."],
        m, latex=r"f(x)=x^3-x-1", tag="ivt", index=2, bareme=3))
    Q.append(item("g12-lh-fn-08", "asymp", "medium",
        "f(x)=(2x+1)/(x−1) has a vertical asymptote x=1 and horizontal asymptote:",
        [r"\(y=0\)", r"\(y=1\)", r"\(y=2\)", r"\(y=x\)"], 2,
        ["Degree 1/1, ratio of leading coefficients = 2."],
        m, latex=r"f(x)=\frac{2x+1}{x-1}", tag="asymp", index=3, bareme=2))
    return Q


def probability_lh() -> list[dict]:
    m = ["LH official-style scaffold"]
    Q = []
    Q.append(item("g12-lh-pr-01", "count", "easy",
        "A fair die is rolled. P(even) equals:",
        [r"\(1/6\)", r"\(1/3\)", r"\(1/2\)", r"\(2/3\)"], 2,
        ["3 even faces out of 6."],
        m, latex=r"P(\text{even})=\frac12", tag="die", index=4, bareme=1))
    Q.append(item("g12-lh-pr-02", "count", "easy",
        "A coin is tossed twice. P(two heads) equals:",
        [r"\(1/4\)", r"\(1/3\)", r"\(1/2\)", r"\(1\)"], 0,
        ["HH among {HH,HT,TH,TT}."],
        m, latex=r"P(HH)=\frac14", tag="coins", index=5, bareme=1))
    Q.append(item("g12-lh-pr-03", "cond", "medium",
        "P(A)=0.4, P(B)=0.5, P(A∩B)=0.2. Then P(A|B) equals:",
        [r"\(0.2\)", r"\(0.4\)", r"\(0.5\)", r"\(0.8\)"], 1,
        ["P(A|B)=0.2/0.5=0.4."],
        m, latex=r"P(A\mid B)=\frac{P(A\cap B)}{P(B)}", tag="cond", index=0, bareme=2))
    Q.append(item("g12-lh-pr-04", "indep", "medium",
        "If A and B are independent with P(A)=0.3 and P(B)=0.5 then P(A∩B) equals:",
        [r"\(0.15\)", r"\(0.8\)", r"\(0.2\)", r"\(0.3\)"], 0,
        ["Independence: product 0.15."],
        m, latex=r"P(A\cap B)=P(A)P(B)", tag="indep", index=1, bareme=2))
    Q.append(item("g12-lh-pr-05", "rv", "hard",
        "X takes 0,1,2 with probabilities 0.2, 0.5, 0.3. Then E(X) equals:",
        [r"\(0.5\)", r"\(1.0\)", r"\(1.1\)", r"\(1.5\)"], 2,
        ["0·0.2+1·0.5+2·0.3=1.1."],
        m, latex=r"E(X)=\sum x_i p_i", tag="expect", index=2, bareme=3))
    Q.append(item("g12-lh-pr-06", "count", "hard",
        "C(5,2) equals:",
        [r"\(5\)", r"\(10\)", r"\(20\)", r"\(25\)"], 1,
        ["5·4/2=10."],
        m, latex=r"\binom{5}{2}=10", tag="binom", index=3, bareme=3))
    Q.append(item("g12-lh-pr-07", "total", "medium",
        "A bag has 3 red and 2 blue balls. Two are drawn without replacement. P(both red) equals:",
        [r"\(3/5\)", r"\(6/20\)", r"\(3/10\)", r"\(2/5\)"], 2,
        ["(3/5)·(2/4)=6/20=3/10."],
        m, latex=r"P(RR)=\frac{3}{5}\cdot\frac{2}{4}", tag="without-rep", index=4, bareme=2))
    Q.append(item("g12-lh-pr-08", "rv", "easy",
        "A fair coin: X=1 on heads, 0 on tails. E(X) equals:",
        [r"\(0\)", r"\(1/2\)", r"\(1\)", r"\(2\)"], 1,
        ["Bernoulli p=1/2."],
        m, latex=r"E(X)=p=\frac12", tag="bernoulli", index=5, bareme=1))
    return Q


def analytic_lh() -> list[dict]:
    m = ["LH official-style scaffold"]
    Q = []
    Q.append(item("g12-lh-ag-01", "line", "easy",
        "The slope of the line through A(0,1) and B(2,5) is:",
        [r"\(1\)", r"\(2\)", r"\(3\)", r"\(4\)"], 1,
        ["(5−1)/(2−0)=2."],
        m, latex=r"m=\frac{y_B-y_A}{x_B-x_A}", tag="slope", index=0, bareme=1))
    Q.append(item("g12-lh-ag-02", "mid", "easy",
        "The midpoint of A(2,4) and B(6,0) is:",
        [r"\((4,2)\)", r"\((8,4)\)", r"\((2,2)\)", r"\((4,4)\)"], 0,
        ["((2+6)/2,(4+0)/2)=(4,2)."],
        m, latex=r"I=\left(\frac{x_A+x_B}{2},\frac{y_A+y_B}{2}\right)", tag="mid", index=1, bareme=1))
    Q.append(item("g12-lh-ag-03", "eq", "medium",
        "An equation of the line of slope 2 through (0,1) is:",
        [r"\(y=2x\)", r"\(y=2x+1\)", r"\(y=x+2\)", r"\(y=2x-1\)"], 1,
        ["y−1=2(x−0)."],
        m, latex=r"y=2x+1", tag="eq", index=2, bareme=2))
    Q.append(item("g12-lh-ag-04", "dist", "medium",
        "The distance AB for A(0,0), B(3,4) is:",
        [r"\(3\)", r"\(4\)", r"\(5\)", r"\(7\)"], 2,
        ["√(9+16)=5."],
        m, latex=r"AB=\sqrt{3^2+4^2}", tag="dist", index=3, bareme=2))
    Q.append(item("g12-lh-ag-05", "perp", "hard",
        "A line of slope 2 has perpendicular slope:",
        [r"\(2\)", r"\(-2\)", r"\(1/2\)", r"\(-1/2\)"], 3,
        ["Product of slopes = −1 ⇒ m'=−1/2."],
        m, latex=r"m\cdot m'=-1", tag="perp", index=4, bareme=3))
    Q.append(item("g12-lh-ag-06", "align", "hard",
        "A(0,0), B(1,2), C(2,4) are aligned because:",
        [r"\(AB=BC\)", r"\(\overrightarrow{AB}=2\overrightarrow{AC}\)", r"\(\overrightarrow{AC}=2\overrightarrow{AB}\)", r"\(AC=1\)"], 2,
        ["AC=(2,4)=2(1,2)=2 AB."],
        m, latex=r"\overrightarrow{AC}=2\overrightarrow{AB}", tag="colinear", index=5, bareme=3))
    Q.append(item("g12-lh-ag-07", "eq", "easy",
        "The line x=3 is:",
        [r"horizontal", r"vertical", r"slope 3", r"through origin"], 1,
        ["Constant x: vertical line."],
        m, latex=r"x=3", tag="vertical", index=0, bareme=1))
    Q.append(item("g12-lh-ag-08", "mid", "medium",
        "The perpendicular bisector of A(0,0), B(2,0) has equation:",
        [r"\(x=0\)", r"\(x=1\)", r"\(y=1\)", r"\(y=x\)"], 1,
        ["Midpoint (1,0), perpendicular to (2,0) is vertical x=1."],
        m, latex=r"x=1", tag="pb", index=1, bareme=2))
    return Q


def differential_extra() -> list[dict]:
    m = ["GS-All.pdf"]
    Q = []
    Q.append(item("g12-gs-de-x-01", "first-order", "easy",
        "The differential equation y'=2y has solutions of the form:",
        [r"\(y=Ce^{2x}\)", r"\(y=C e^{-2x}\)", r"\(y=2x+C\)", r"\(y=C/x\)"], 0,
        ["Separable: dy/y=2 dx ⇒ ln|y|=2x+k."],
        m, latex=r"y'=2y", tag="exp-growth", index=2, bareme=1))
    Q.append(item("g12-gs-de-x-02", "first-order", "easy",
        "A particular solution of y'+y=0 with y(0)=3 is:",
        [r"\(y=3e^x\)", r"\(y=3e^{-x}\)", r"\(y=3\)", r"\(y=e^{-3x}\)"], 1,
        ["General Ce^{-x}; C=3."],
        m, latex=r"y'+y=0,\ y(0)=3", tag="ivp", index=3, bareme=1))
    Q.append(item("g12-gs-de-x-03", "second-order", "medium",
        "For y''−y=0 the characteristic roots are ±1, so the general solution is:",
        [r"\(Ae^x+Be^{-x}\)", r"\(Ae^{x}+Be^{x}\)", r"\(A\cos x+B\sin x\)", r"\(Ax+B\)"], 0,
        ["Distinct real roots ±1."],
        m, latex=r"y''-y=0", tag="char-pm1", index=4, bareme=2))
    Q.append(item("g12-gs-de-x-04", "second-order", "medium",
        "y''+4y=0 has characteristic r²+4=0, so r=±2i and the general solution is:",
        [r"\(e^{2x}(A\cos x+B\sin x)\)", r"\(A\cos 2x+B\sin 2x\)", r"\(A e^{2x}+B e^{-2x}\)", r"\(Ax+B\)"], 1,
        ["Pure imaginary ±2i → cos(2x), sin(2x)."],
        m, latex=r"y''+4y=0", tag="harmonic", index=5, bareme=2))
    Q.append(item("g12-gs-de-x-05", "linear", "hard",
        "A particular solution of y'−y=e^{2x} may be sought as ke^{2x}. Then k equals:",
        [r"\(1\)", r"\(1/2\)", r"\(2\)", r"\(-1\)"], 0,
        ["2k e^{2x} − k e^{2x}=e^{2x} ⇒ k=1."],
        m, latex=r"y'-y=e^{2x}", tag="undetermined", index=0, bareme=3))
    Q.append(item("g12-gs-de-x-06", "linear", "hard",
        "The equation y'+2y=4 has equilibrium y=2. Solutions tend to 2 as x→+∞ because the homogeneous factor is e^{-2x}. The general solution is:",
        [r"\(y=2+Ce^{-2x}\)", r"\(y=2+Ce^{2x}\)", r"\(y=4+Ce^{-2x}\)", r"\(y=Ce^{-2x}\)"], 0,
        ["Particular y=2; homogeneous Ce^{-2x}."],
        m, latex=r"y'+2y=4", tag="affine-de", index=1, bareme=3))
    Q.append(item("g12-gs-de-x-07", "second-order", "medium",
        "If y=e^{rx} solves y''+3y'+2y=0 then r satisfies:",
        [r"\(r^2+3r+2=0\)", r"\(r^2-3r+2=0\)", r"\(r+3=0\)", r"\(r^2+2=0\)"], 0,
        ["Substitute: (r²+3r+2)e^{rx}=0."],
        m, latex=r"r^2+3r+2=0", tag="char", index=2, bareme=2))
    Q.append(item("g12-gs-de-x-08", "first-order", "easy",
        "The solutions of y'=0 are:",
        [r"\(y=x+C\)", r"\(y=C\)", r"\(y=e^{Cx}\)", r"\(y=0\) only"], 1,
        ["Zero derivative: constant functions."],
        m, latex=r"y'=0", tag="const", index=3, bareme=1))
    return Q


def slices(*pairs: tuple[str, str, str]) -> list[dict]:
    return [{"id": a, "title": b, "arabicTitle": c} for a, b, c in pairs]


def main() -> None:
    print("Scaffold banks for exam engine")

    dump(BANKS / "g12-ls/sequences.json", bank(
        bank_id="g12-ls-sequences",
        certificate="LS",
        topic="sequences",
        title="Sequences",
        arabic_title="المتتاليات",
        models=["LS all sessions.pdf"],
        slices=slices(("arith", "Arithmetic", "حسابية"), ("geo", "Geometric", "هندسية"),
                      ("limit", "Limits of sequences", "نهاية المتتالية"),
                      ("recur", "Recurrence", "علاقات تراجعية"),
                      ("closed", "Closed form", "الشكل الصريح"),
                      ("sum", "Sums", "المجموع")),
        questions=sequences_ls(),
        contest_topics=[{"id": "sequences", "file": "content/banks/g12-ls/sequences.json",
                         "title": "Sequences", "arabicTitle": "المتتاليات", "implemented": True}],
    ))

    dump(BANKS / "g12-gs/sequences.json", bank(
        bank_id="g12-gs-sequences",
        certificate="GS",
        topic="sequences",
        title="Sequences",
        arabic_title="المتتاليات",
        models=["GS-All.pdf"],
        slices=slices(("arith", "Arithmetic", "حسابية"), ("limit", "Limits", "النهايات"),
                      ("recur", "Recurrence", "تراجعية"), ("closed", "Closed form", "الشكل الصريح"),
                      ("mono", "Monotone convergence", "الرتابة والتقارب"),
                      ("sum", "Series", "السلاسل"), ("complex-seq", "Complex sequences", "متتاليات مركبة")),
        questions=sequences_gs(),
        contest_topics=[{"id": "sequences", "file": "content/banks/g12-gs/sequences.json",
                         "title": "Sequences", "arabicTitle": "المتتاليات", "implemented": True}],
    ))

    dump(BANKS / "g12-se/sequences.json", bank(
        bank_id="g12-se-sequences",
        certificate="SE",
        topic="sequences",
        title="Sequences (economic models)",
        arabic_title="المتتاليات والنماذج الاقتصادية",
        models=["SE_All Sessions.pdf"],
        slices=slices(("finance", "Finance", "مالية"), ("arith", "Arithmetic", "حسابية"),
                      ("limit", "Limits", "النهايات"), ("sum", "Series / PV", "السلاسل"),
                      ("closed", "Equilibria", "التوازن"), ("geo", "Geometric growth", "نمو هندسي")),
        questions=sequences_se(),
        contest_topics=[{"id": "sequences", "file": "content/banks/g12-se/sequences.json",
                         "title": "Sequences", "arabicTitle": "المتتاليات", "implemented": True}],
    ))

    dump(BANKS / "g12-gs/differential.json", bank(
        bank_id="g12-gs-differential",
        certificate="GS",
        topic="differential",
        title="Differential equations",
        arabic_title="المعادلات التفاضلية",
        models=["GS-All.pdf"],
        slices=slices(("first-order", "First order", "الرتبة الأولى"),
                      ("second-order", "Second order", "الرتبة الثانية"),
                      ("linear", "Linear non-homogeneous", "خطية غير متجانسة")),
        questions=differential_extra(),
        contest_minutes=25,
        contest_topics=[{"id": "differential", "file": "content/banks/g12-gs/differential.json",
                         "title": "Differential equations", "arabicTitle": "المعادلات التفاضلية",
                         "implemented": True}],
    ))

    dump(BANKS / "g12-lh/functions.json", bank(
        bank_id="g12-lh-functions",
        certificate="LH",
        topic="functions",
        title="Functions (LH)",
        arabic_title="الدوال — آداب وإنسانيات",
        models=["LH official-style scaffold"],
        slices=slices(("poly", "Polynomials", "كثيرات الحدود"), ("sign", "Variation", "التغيرات"),
                      ("limit", "Limits", "النهايات"), ("ln", "Logarithm", "اللوغاريتم"),
                      ("exp", "Exponential", "الأسّية"), ("tangent", "Tangent", "المماس"),
                      ("root", "Roots / IVT", "الجذور"), ("asymp", "Asymptotes", "التقارب")),
        questions=functions_lh(),
        contest_topics=LH_TOPICS,
    ))

    dump(BANKS / "g12-lh/sequences.json", bank(
        bank_id="g12-lh-sequences",
        certificate="LH",
        topic="sequences",
        title="Sequences (LH)",
        arabic_title="المتتاليات — آداب وإنسانيات",
        models=["LH official-style scaffold"],
        slices=slices(("arith", "Arithmetic", "حسابية"), ("geo", "Geometric", "هندسية"),
                      ("limit", "Limits", "النهايات"), ("recur", "Recurrence", "تراجعية"),
                      ("sum", "Sums", "المجموع"), ("closed", "Closed form", "الشكل الصريح")),
        questions=sequences_lh(),
        contest_topics=LH_TOPICS,
    ))

    dump(BANKS / "g12-lh/probability.json", bank(
        bank_id="g12-lh-probability",
        certificate="LH",
        topic="probability",
        title="Probability (LH)",
        arabic_title="الاحتمالات — آداب وإنسانيات",
        models=["LH official-style scaffold"],
        slices=slices(("count", "Counting", "العدّ"), ("cond", "Conditional", "الشرطية"),
                      ("indep", "Independence", "الاستقلال"), ("rv", "Random variable", "المتغير العشوائي"),
                      ("total", "Compound", "مركّبة")),
        questions=probability_lh(),
        contest_topics=LH_TOPICS,
    ))

    dump(BANKS / "g12-lh/analytic-geometry.json", bank(
        bank_id="g12-lh-analytic-geometry",
        certificate="LH",
        topic="analytic_geometry",
        title="Analytic geometry (LH)",
        arabic_title="الهندسة التحليلية — آداب وإنسانيات",
        models=["LH official-style scaffold"],
        slices=slices(("line", "Lines", "المستقيمات"), ("mid", "Midpoint", "المنتصف"),
                      ("eq", "Equations", "المعادلات"), ("dist", "Distance", "المسافة"),
                      ("perp", "Perpendicular", "التعامد"), ("align", "Alignment", "الاستقامة")),
        questions=analytic_lh(),
        contest_topics=LH_TOPICS + [{
            "id": "analytic-geometry",
            "file": "content/banks/g12-lh/analytic-geometry.json",
            "title": "Analytic geometry",
            "arabicTitle": "الهندسة التحليلية",
            "implemented": True,
        }],
    ))

    print("done")


if __name__ == "__main__":
    main()
