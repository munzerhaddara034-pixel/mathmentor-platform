#!/usr/bin/env python3
"""Bootstrap-only assembler for content/banks/g12-ls/functions.json.

Do NOT re-run this after session-style items exist: it rebuilds from
/tmp/limits-quiz.json + hardcoded extras and would drop variation /
asymptotes / inverse slices.

To add official-session-style items, edit and run:
  python3 scripts/merge-session-style-functions.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIMITS_DUMP = Path("/tmp/limits-quiz.json")
OUT = ROOT / "content/banks/g12-ls/functions.json"

SOURCE = {
    "kind": "generated-in-official-style",
    "models": ["LS all sessions.pdf"],
    "note": "Academy-original item in Lebanese Grade 12 LS session style. Not a photocopy of the official PDF.",
}

DIFF_LABEL = {1: "easy", 2: "medium", 3: "medium", 4: "hard"}
SLICE_RANK = {"limits": 0, "continuity": 1, "derivatives": 2}
BAND_RANK = {"easy": 0, "medium": 1, "hard": 2}


def item(qid, slice_id, difficulty, stem, choices, answer_index, sketch, latex=None, tag=""):
    answer = choices[answer_index]
    row = {
        "id": qid,
        "slice": slice_id,
        "difficulty": difficulty,
        "source": {**SOURCE, "tag": tag or slice_id},
        "stem": stem,
        "choices": choices,
        "answerIndex": answer_index,
        "answer": answer,
        "solutionSketch": sketch,
    }
    if latex:
        row["latex"] = latex
    return row


def from_limits(raw: list[dict]) -> list[dict]:
    rows = []
    for q in raw:
        n = q["id"].rsplit("-q", 1)[-1]
        rows.append(
            item(
                q["id"],
                "limits",
                DIFF_LABEL[int(q["difficulty"])],
                q["prompt"],
                q["options"],
                int(q["correctIndex"]),
                q["steps"],
                q.get("latex"),
                tag="limits",
            )
        )
        rows[-1]["lessonId"] = "grade-12-ch1"
    return rows


EXTRAS = [
    # --- continuity easy ---
    item(
        "g12-ls-fn-cont-01",
        "continuity",
        "easy",
        "لتكن f(x)=x+1 إذا x<1، و f(1)=3، و f(x)=2x إذا x>1. هل f مستمرة عند 1؟",
        [
            "نعم، لأن النهاية موجودة",
            "لا، لأن النهاية تساوي 2 بينما f(1)=3",
            "نعم، لأن f(1) موجودة",
            "لا، لأن النهاية غير موجودة",
        ],
        1,
        [
            "من اليسار: x+1 → 2. من اليمين: 2x → 2. النهاية 2.",
            "f(1)=3 ≠ 2، فشرط الاستمرار الثالث يسقط.",
            "الفخ: الاكتفاء بوجود النهاية أو بوجود القيمة.",
        ],
        tag="continuity-piecewise",
    ),
    item(
        "g12-ls-fn-cont-02",
        "continuity",
        "easy",
        "أي الدوال الآتية مستمرة على كل ℝ؟",
        ["\\(1/x\\)", "\\(\\tan x\\)", "\\(|x|\\)", "\\(\\sqrt{x}\\)"],
        2,
        [
            "القيمة المطلقة مستمرة على ℝ (مركب كثير حدود مع دالة مستمرة).",
            "1/x غير معرّفة عند 0. tan x غير معرّفة عند π/2. √x على [0,+∞) فقط.",
        ],
        tag="continuity-domain",
    ),
    item(
        "g12-ls-fn-cont-03",
        "continuity",
        "easy",
        "أوجد k حتى تكون f مستمرة عند 1: f(x)=x² إذا x<1، و f(x)=k إذا x≥1.",
        ["\\(0\\)", "\\(1\\)", "\\(2\\)", "أي عدد"],
        1,
        [
            "نهاية اليسار: 1. نهاية اليمين والقيمة: k.",
            "للاستمرار k=1. الفخ: k=2 من مشتقة 2x عند 1 (ذلك للمشتقة لا للاستمرار).",
        ],
        latex="f(x)=\\begin{cases} x^2 & x<1 \\\\ k & x\\ge 1 \\end{cases}",
        tag="continuity-parameter",
    ),
    # --- continuity medium ---
    item(
        "g12-ls-fn-cont-04",
        "continuity",
        "medium",
        "f(x)=(x²−4)/(x−2) إذا x≠2 و f(2)=k. تكون f مستمرة عند 2 إذا وفقط إذا:",
        ["\\(k=0\\)", "\\(k=2\\)", "\\(k=4\\)", "لا يوجد مثل هذا k"],
        2,
        [
            "النهاية عند 2 تساوي 4 بعد اختزال (x−2).",
            "الاستمرار يطلب f(2)=النهاية، إذن k=4 (انقطاع قابل للرفع إن k≠4).",
            "الفخ: k=0 لأن التعويض 0/0، أو «لا يوجد» لأن العبارة الأصلية غير معرّفة.",
        ],
        latex="f(2)=k,\\quad f(x)=\\frac{x^2-4}{x-2}\\ (x\\neq 2)",
        tag="continuity-removable",
    ),
    item(
        "g12-ls-fn-cont-05",
        "continuity",
        "medium",
        "عند x=1 للدالة f(x)=|x−1| تكون العبارة الصحيحة:",
        [
            "مستمرة وقابلة للاشتقاق",
            "مستمرة وغير قابلة للاشتقاق",
            "غير مستمرة",
            "النهاية غير موجودة",
        ],
        1,
        [
            "المطلق مستمر. مشتقتا اليمين واليسار: 1 و −1، فغير قابلة للاشتقاق عند الرأس.",
            "الفخ الشائع: خلط الاستمرار مع قابلية الاشتقاق.",
        ],
        latex="f(x)=|x-1|",
        tag="continuity-vs-derivative",
    ),
    item(
        "g12-ls-fn-cont-06",
        "continuity",
        "medium",
        "f(x)=x³−x−1 على [1,2]. أي الاستنتاجات صحيحة؟",
        [
            "يوجد جذر في (1,2) حسب مبرهنة القيم الوسيطة",
            "f(1.5)=0",
            "لا جذر في [1,2]",
            "الجذر الوحيد في (0,1)",
        ],
        0,
        [
            "f مستمرة على [1,2]. f(1)=−1<0 و f(2)=5>0، فتمر بالصفر.",
            "المبرهنة لا تعيّن أن 1.5 جذر. الفخ: حساب نقطة وسط بلا تعويض.",
        ],
        latex="f(x)=x^3-x-1",
        tag="continuity-ivt",
    ),
    item(
        "g12-ls-fn-cont-07",
        "continuity",
        "medium",
        "f(x)=sin(x)/x إذا x≠0 و f(0)=a. تكون f مستمرة عند 0 إذا:",
        ["\\(a=0\\)", "\\(a=1\\)", "\\(a=\\pi\\)", "لا يمكن لأي a"],
        1,
        [
            "نهاية sin x / x عند 0 تساوي 1، فالاستمرار يطلب a=1.",
            "الفخ: a=0 لأن sin 0=0.",
        ],
        latex="f(x)=\\frac{\\sin x}{x}\\ (x\\neq 0),\\ f(0)=a",
        tag="continuity-standard-limit",
    ),
    item(
        "g12-ls-fn-cont-08",
        "continuity",
        "medium",
        "هل يمكن تمديد f(x)=1/x باستمرار على ℝ بتعريف قيمة عند 0؟",
        ["نعم، بوضع f(0)=0", "نعم، بوضع f(0)=1", "لا، لأن النهايتين من الجهتين غير منتهيتين ومختلفتي الإشارة", "نعم، بأي قيمة"],
        2,
        [
            "من اليمين +∞ ومن اليسار −∞. لا نهاية منتهية، فلا تمديد مستمر.",
            "الفخ: خلط مع الانقطاع القابل للرفع مثل (x²−1)/(x−1).",
        ],
        latex="f(x)=\\frac{1}{x}",
        tag="continuity-essential",
    ),
    # --- continuity hard ---
    item(
        "g12-ls-fn-cont-09",
        "continuity",
        "hard",
        "f(x)=x² sin(1/x) إذا x≠0 و f(0)=0. نهاية f عند 0 تساوي:",
        ["غير موجودة لأن sin(1/x) يتذبذب", "\\(0\\)", "\\(1\\)", "لا يمكن الجزم"],
        1,
        [
            "\\(|x^2\\sin(1/x)|\\le x^2\\). المبرهنة الحصارية تعطي النهاية 0=f(0)، فالدالة مستمرة عند 0.",
            "الفخ: التذبذب وحده لا يلغي النهاية عندما يُسحق بالمعامل x².",
        ],
        latex="f(x)=x^2\\sin\\frac{1}{x}\\ (x\\neq 0),\\ f(0)=0",
        tag="continuity-squeeze",
    ),
    item(
        "g12-ls-fn-cont-10",
        "continuity",
        "hard",
        "f(x)=(x²+ax+b)/(x−1) إذا x≠1 و f(1)=4. حتى تكون f مستمرة عند 1، يكون (a,b):",
        ["\\((2,-3)\\)", "\\((4,-5)\\)", "\\((0,-1)\\)", "\\((-2,1)\\)"],
        0,
        [
            "يلزم انعدام البسط عند 1: 1+a+b=0، وأن تساوي النهاية 4.",
            "بعد الاختزال النهاية = 2+a، فـ a=2 ثم b=−3.",
            "الفخ (4,−5): فرض f(1)=4 من دون جعل البسط صفراً.",
        ],
        latex="f(x)=\\frac{x^2+ax+b}{x-1}\\ (x\\neq 1),\\ f(1)=4",
        tag="continuity-two-parameters",
    ),
    item(
        "g12-ls-fn-cont-11",
        "continuity",
        "hard",
        "f(x)=x+1 إذا x<0، و ax+b إذا 0≤x≤2، و x² إذا x>2. حتى تكون مستمرة على ℝ:",
        ["\\(a=1,\\ b=1\\)", "\\(a=\\tfrac{3}{2},\\ b=1\\)", "\\(a=2,\\ b=0\\)", "\\(a=1,\\ b=0\\)"],
        1,
        [
            "عند 0: b = 1 (اتصال مع x+1).",
            "عند 2: 2a+b = 4، فـ 2a+1=4 و a=3/2.",
            "الفخ: مساواة المشتقات (ذلك لـ C¹ لا للاستمرار).",
        ],
        latex="f\\text{ piecewise on }(-\\infty,0),[0,2],(2,+\\infty)",
        tag="continuity-two-junctions",
    ),
    item(
        "g12-ls-fn-cont-12",
        "continuity",
        "hard",
        "f(x)=|x|/x إذا x≠0 و f(0)=0. عند 0 تكون f:",
        ["مستمرة", "غير مستمرة لأن نهايتي اليمين واليسار مختلفتان", "مستمرة لأن f(0)=0", "قابلة للاشتقاق"],
        1,
        [
            "اليمين 1 واليسار −1. النهاية الثنائية غير موجودة، فغير مستمرة مهما كانت f(0).",
            "الفخ: اختيار 0 كمتوسط الجهتين.",
        ],
        latex="f(x)=\\frac{|x|}{x}\\ (x\\neq 0),\\ f(0)=0",
        tag="continuity-jump",
    ),
    # --- derivatives easy ---
    item(
        "g12-ls-fn-der-01",
        "derivatives",
        "easy",
        "إذا كانت f(x)=x²+3x فإن f'(2) تساوي:",
        ["\\(3\\)", "\\(4\\)", "\\(7\\)", "\\(10\\)"],
        2,
        [
            "f'(x)=2x+3، فـ f'(2)=7.",
            "هذا الحساب يظهر في نماذج علوم الحياة. الفخ: f(2)=10 أو نسيان 3.",
        ],
        latex="f(x)=x^2+3x",
        tag="derivatives-polynomial",
    ),
    item(
        "g12-ls-fn-der-02",
        "derivatives",
        "easy",
        "احسب المشتقة ثم القيمة:",
        ["\\(6\\)", "\\(8\\)", "\\(12\\)", "\\(24\\)"],
        2,
        ["(x³)'=3x²، عند 2: 3·4=12.", "الفخ: 8=2³ أو 6=3·2."],
        latex="\\frac{d}{dx}(x^3)\\Big|_{x=2}",
        tag="derivatives-power",
    ),
    item(
        "g12-ls-fn-der-03",
        "derivatives",
        "easy",
        "مشتقة f(x)=5x−4 تساوي:",
        ["\\(5x\\)", "\\(5\\)", "\\(-4\\)", "\\(0\\)"],
        1,
        ["مشتقة دالة خطية ax+b هي a. الفخ: إبقاء 5x أو أخذ الحد الثابت."],
        latex="f(x)=5x-4",
        tag="derivatives-linear",
    ),
    item(
        "g12-ls-fn-der-04",
        "derivatives",
        "easy",
        "احسب:",
        ["\\(3\\)", "\\(4\\)", "\\(12\\)", "\\(81\\)"],
        2,
        ["(3x⁴)'=12x³، عند 1 تساوي 12.", "الفخ: 3 أو 3·1⁴."],
        latex="\\frac{d}{dx}(3x^4)\\Big|_{x=1}",
        tag="derivatives-coefficient",
    ),
    # --- derivatives medium ---
    item(
        "g12-ls-fn-der-05",
        "derivatives",
        "medium",
        "f(x)=x²(x+1). فإن f'(1) تساوي:",
        ["\\(2\\)", "\\(3\\)", "\\(5\\)", "\\(6\\)"],
        2,
        [
            "انشر: x³+x²، فالمشتقة 3x²+2x. عند 1: 3+2=5.",
            "أو جداء: 2x(x+1)+x². عند 1: 4+1=5. الفخ: 2 من مشتقة العامل الأول فقط.",
        ],
        latex="f(x)=x^2(x+1)",
        tag="derivatives-product",
    ),
    item(
        "g12-ls-fn-der-06",
        "derivatives",
        "medium",
        "احسب مشتقة (2x−1)³ عند x=1:",
        ["\\(3\\)", "\\(6\\)", "\\(8\\)", "\\(24\\)"],
        1,
        [
            "سلسلة: 3(2x−1)²·2. عند 1: 3(1)²·2=6.",
            "الفخ: نسيان ضرب 2 (مشتقة الداخل) فيبقى 3، أو حساب القيمة 1 لا المشتقة.",
        ],
        latex="\\frac{d}{dx}(2x-1)^3\\Big|_{x=1}",
        tag="derivatives-chain",
    ),
    item(
        "g12-ls-fn-der-07",
        "derivatives",
        "medium",
        "معادلة المماس لمنحنى y=x² عند النقطة (1,1) هي:",
        ["\\(y=x\\)", "\\(y=2x\\)", "\\(y=2x-1\\)", "\\(y=x^2+1\\)"],
        2,
        [
            "الميل y'=2x عند 1 يساوي 2. المماس: y−1=2(x−1) أي y=2x−1.",
            "الفخ: y=2x بنسيان المرور بالنقطة.",
        ],
        latex="y=x^2\\ \\text{at }(1,1)",
        tag="derivatives-tangent",
    ),
    item(
        "g12-ls-fn-der-08",
        "derivatives",
        "medium",
        "بحسب التعريف، هذه النهاية تساوي f'(1) لـ f(x)=x². قيمتها:",
        ["\\(0\\)", "\\(1\\)", "\\(2\\)", "غير موجودة"],
        2,
        [
            "( (1+h)²−1 )/h = (1+2h+h²−1)/h = 2+h → 2.",
            "الفخ: التعويض h=0 مباشرة 0/0 ثم «غير موجودة».",
        ],
        latex="\\lim_{h\\to 0}\\frac{(1+h)^2-1}{h}",
        tag="derivatives-definition",
    ),
    item(
        "g12-ls-fn-der-09",
        "derivatives",
        "medium",
        "إذا كانت f(x)=sin x فإن f'(0) تساوي:",
        ["\\(0\\)", "\\(1\\)", "\\(-1\\)", "غير موجودة"],
        1,
        ["f'=cos x و cos 0=1. الفخ: sin 0=0."],
        latex="f(x)=\\sin x",
        tag="derivatives-trig",
    ),
    item(
        "g12-ls-fn-der-10",
        "derivatives",
        "medium",
        "احسب مشتقة (2x+1)/(x−1) عند x=2:",
        ["\\(1\\)", "\\(0\\)", "\\(-3\\)", "\\(5\\)"],
        2,
        [
            "قاعدة القسمة: [2(x−1)−(2x+1)·1]/(x−1)² = (2x−2−2x−1)/(x−1)² = −3/(x−1)².",
            "عند 2: −3/1=−3. الفخ: مشتقة البسط فقط أو إشارة موجبة.",
        ],
        latex="f(x)=\\frac{2x+1}{x-1}",
        tag="derivatives-quotient",
    ),
    item(
        "g12-ls-fn-der-11",
        "derivatives",
        "medium",
        "f(x)=x³−3x. على أي مجال تكون f متناقصة؟",
        ["\\(\\mathbb{R}\\)", "[-1,1]", "[1,+∞)", "(-∞,-1]"],
        1,
        [
            "f'(x)=3x²−3=3(x−1)(x+1). الإشارة سالبة على (−1,1).",
            "متناقصة على [−1,1]. الفخ: قراءة إشارة خاطئة أو أخذ [1,+∞) حيث f'>0.",
        ],
        latex="f(x)=x^3-3x",
        tag="derivatives-variation",
    ),
    item(
        "g12-ls-fn-der-12",
        "derivatives",
        "medium",
        "احسب (√x)' عند x=4:",
        ["\\(2\\)", "\\(\\dfrac{1}{2}\\)", "\\(\\dfrac{1}{4}\\)", "\\(\\dfrac{1}{8}\\)"],
        2,
        [
            "(√x)'=1/(2√x). عند 4: 1/(2·2)=1/4.",
            "الفخ: 1/8 من وضع 2·4 في المقام، أو 1/2 من نسيان الجذر في المقام.",
        ],
        latex="\\frac{d}{dx}\\sqrt{x}\\Big|_{x=4}",
        tag="derivatives-root",
    ),
    # --- derivatives hard ---
    item(
        "g12-ls-fn-der-13",
        "derivatives",
        "hard",
        "f(x)=x² sin(1/x) إذا x≠0 و f(0)=0. فإن f'(0) تساوي:",
        ["غير موجودة بسبب التذبذب", "\\(0\\)", "\\(1\\)", "\\(+\\infty\\)"],
        1,
        [
            "f'(0)=lim_{h→0} h sin(1/h). |h sin(1/h)|≤|h|→0، فـ f'(0)=0.",
            "الاستمرار عند 0 لا يكفي وحده؛ هنا التعريف يعطي المشتقة. الفخ: التذبذب ⇒ غير موجودة.",
        ],
        latex="f'(0)=\\lim_{h\\to 0} h\\sin\\frac{1}{h}",
        tag="derivatives-at-zero",
    ),
    item(
        "g12-ls-fn-der-14",
        "derivatives",
        "hard",
        "f(x)=x² إذا x≤1 و f(x)=ax+b إذا x>1. حتى تكون f قابلة للاشتقاق عند 1 (ومستمرة):",
        ["\\(a=1,\\ b=0\\)", "\\(a=2,\\ b=-1\\)", "\\(a=2,\\ b=1\\)", "\\(a=0,\\ b=1\\)"],
        1,
        [
            "الاستمرار: a+b=1. المشتقة من اليسار 2x|₁=2، من اليمين a، فـ a=2 ثم b=−1.",
            "الفخ: الاستمرار فقط (أزواج أخرى على المستقيم a+b=1).",
        ],
        latex="f(x)=\\begin{cases} x^2 & x\\le 1 \\\\ ax+b & x>1 \\end{cases}",
        tag="derivatives-C1-match",
    ),
    item(
        "g12-ls-fn-der-15",
        "derivatives",
        "hard",
        "كم نقطة على منحنى y=x³−x يكون عندها المماس موازياً للمستقيم y=3x؟",
        ["لا نقطة", "نقطة واحدة", "نقطتان", "ثلاث نقاط"],
        2,
        [
            "الميل 3: f'(x)=3x²−1=3 ⇒ 3x²=4 ⇒ نقطتان حقيقيتان.",
            "الفخ: حل f(x)=3x بدل المشتقة فيعطي ثلاث تقاطعات للمنحنى لا للمماس.",
        ],
        latex="y=x^3-x,\\quad y=3x",
        tag="derivatives-parallel-tangent",
    ),
    item(
        "g12-ls-fn-der-16",
        "derivatives",
        "hard",
        "f(x)=(x²−1)/(x−1) إذا x≠1 و f(1)=2. فإن f'(1) تساوي:",
        ["غير موجودة لأن المقام ينعدم", "\\(0\\)", "\\(1\\)", "\\(2\\)"],
        2,
        [
            "بعد الاختزال f(x)=x+1 لكل x بما فيها 1 بعد التمديد المستمر.",
            "f'(x)=1، فـ f'(1)=1. الفخ: رفض الاشتقاق لأن الكتابة الأصلية تنعدم عند 1.",
        ],
        latex="f(x)=\\frac{x^2-1}{x-1}\\ (x\\neq 1),\\ f(1)=2",
        tag="derivatives-after-extension",
    ),
    item(
        "g12-ls-fn-der-17",
        "derivatives",
        "hard",
        "هذه النهاية هي مشتقة x³ عند 1. قيمتها:",
        ["\\(0\\)", "\\(1\\)", "\\(3\\)", "غير موجودة"],
        2,
        [
            "((1+h)³−1)/h = (1+3h+3h²+h³−1)/h = 3+3h+h² → 3.",
            "الفخ: 0/0 ⇒ غير موجودة.",
        ],
        latex="\\lim_{h\\to 0}\\frac{(1+h)^3-1}{h}",
        tag="derivatives-definition-cubic",
    ),
]


def main() -> None:
    limits_raw = json.loads(LIMITS_DUMP.read_text(encoding="utf-8"))
    questions = from_limits(limits_raw) + EXTRAS
    questions.sort(key=lambda q: (BAND_RANK[q["difficulty"]], SLICE_RANK[q["slice"]], q["id"]))
    bank = {
        "id": "g12-ls-functions",
        "track": "grade-12",
        "certificate": "LS",
        "topic": "functions",
        "title": "Functions",
        "arabicTitle": "الدوال",
        "lessonId": "grade-12-ch1",
        "contestMinutes": 25,
        "passScore": 70,
        "sourceModels": ["LS all sessions.pdf"],
        "styleNote": "Items are academy-original, written in Lebanese Grade 12 Life Sciences official-session style (algebraic manipulation, parameters, piecewise). They are not copied from the PDF. When Munzer ingests LS all sessions.pdf, tag real stems with source.kind=session-extract and keep generated siblings beside them.",
        "slices": [
            {"id": "limits", "title": "Limits", "arabicTitle": "النهايات", "note": "First slice of the Functions block. Classroom video + notes stay on /classroom/grade-12-ch1."},
            {"id": "continuity", "title": "Continuity", "arabicTitle": "الاستمرار"},
            {"id": "derivatives", "title": "Derivatives", "arabicTitle": "المشتقات"},
        ],
        "order": "easy → medium → hard (within a band: limits, then continuity, then derivatives)",
        "nextTopicFiles": [
            "content/banks/g12-ls/vectors.json",
            "content/banks/g12-ls/integration.json",
            "content/banks/g12-se/functions.json",
            "content/banks/g12-gs/functions.json",
        ],
        "questions": questions,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    bands = {}
    slices = {}
    for q in questions:
        bands[q["difficulty"]] = bands.get(q["difficulty"], 0) + 1
        slices[q["slice"]] = slices.get(q["slice"], 0) + 1
    print(f"Wrote {OUT} ({len(questions)} questions) bands={bands} slices={slices}")


if __name__ == "__main__":
    main()
