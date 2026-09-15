import type { LessonTimeline } from "./timeline";

export const exponentialFunctionsLesson: LessonTimeline = {
  id: "ls-exponential-functions",
  topic: "Exponential Functions",
  track: "ls",
  grade: "Grade 12 · LS / GS",
  title: {
    ar: "الدوال الأسية — شهادة الثانوية اللبنانية",
    en: "Exponential Functions — Lebanese Baccalaureate",
  },
  language: "en",
  durationSec: 240,
  media: {
    poster: "/teachers/munzer.jpg",
  },
  segments: [
    {
      id: "intro",
      start: 0,
      end: 30,
      phase: "introduction",
      avatar: { state: "speaking" },
      narration: {
        ar: "صباح الخير. أنا الأستاذ منذر حدارة. في الشهادة اللبنانية — علوم الحياة والعلوم العامة — تظهر الدالة الأسية داخل النهايات والمشتقات ونماذج النمو. اليوم نعرّف الفكرة، نرسم المنحنى، ثم نحل مثالاً كاملاً كما في الامتحان الرسمي.",
        en: "Good morning. I am Professor Munzer Haddara. In the Lebanese Baccalaureate — Life Sciences and General Sciences — exponential functions hide inside limits, derivatives, and growth models. Today we define the idea, draw the graph, then finish one official-exam style example.",
      },
      canvas: {
        actions: [
          {
            at: 2,
            type: "show_equation",
            payload: {
              latex: "f(x)=a^{x}\\quad (a>0,\\; a\\neq 1)",
              caption: {
                ar: "تعريف الدالة الأسية",
                en: "Concept definition",
              },
            },
          },
          {
            at: 12,
            type: "show_step",
            payload: {
              latex: "D_f=\\mathbb{R},\\quad f(x)>0",
              text: {
                ar: "المجال كل الأعداد الحقيقية، والقيم موجبة دائماً.",
                en: "Domain is all real numbers; outputs stay strictly positive.",
              },
            },
          },
          {
            at: 20,
            type: "show_step",
            payload: {
              latex: "a^{x+y}=a^{x}\\,a^{y}",
              text: {
                ar: "قانون الجمع في الأس — أساس كل تعويض لاحق.",
                en: "The product rule for exponents — the engine of later substitution.",
              },
            },
          },
        ],
      },
    },
    {
      id: "rule-graph",
      start: 30,
      end: 90,
      phase: "rule_graph",
      avatar: { state: "paused" },
      narration: {
        ar: "أقف عند اللوح. انظر إلى المنحنى y=e^x. لا جذور حقيقية: المنحنى لا يقطع محور السينات. خط التقارب الأفقي هو y=0. لا نهاية صغرى ولا عظمى على ℝ لأن الدالة متزايدة تماماً. النقطة (0,1) هي مفتاح التحقق.",
        en: "I freeze at the board. Watch y = e^x being drawn. There are no real roots: the curve never meets the x-axis. The horizontal asymptote is y = 0. There are no extrema on the real line because the function is strictly increasing. The point (0, 1) is your check.",
      },
      canvas: {
        actions: [
          {
            at: 0,
            type: "show_equation",
            payload: {
              latex: "y=e^{x}",
              caption: { ar: "القاعدة + الرسم الإلزامي", en: "Rule and mandatory graph" },
            },
          },
          {
            at: 6,
            type: "render_graph",
            payload: {
              kind: "function",
              fn: "exp(x)",
              xDomain: [-2.5, 2.5],
              yDomain: [-1, 12],
              title: { ar: "y = e^x", en: "y = e^x" },
            },
          },
          {
            at: 16,
            type: "highlight_point",
            payload: {
              kind: "asymptote",
              axis: "y",
              value: 0,
              label: { ar: "تقارب أفقي y=0", en: "Asymptote y = 0" },
            },
          },
          {
            at: 28,
            type: "highlight_point",
            payload: {
              kind: "point",
              x: 0,
              y: 1,
              label: { ar: "f(0)=1", en: "f(0) = 1" },
            },
          },
          {
            at: 40,
            type: "show_step",
            payload: {
              latex: "\\nexists x\\in\\mathbb{R}:\\; e^{x}=0",
              text: {
                ar: "لا جذور حقيقية — خطأ شائع في نماذج العلوم العامة.",
                en: "No real roots — a frequent GS/LS exam trap.",
              },
            },
          },
          {
            at: 50,
            type: "highlight_point",
            payload: {
              kind: "extrema",
              label: {
                ar: "لا نهاية محلية على ℝ (متزايدة تماماً)",
                en: "No extrema on ℝ (strictly increasing)",
              },
            },
          },
        ],
      },
    },
    {
      id: "real-example",
      start: 90,
      end: 210,
      phase: "real_example",
      avatar: { state: "speaking" },
      narration: {
        ar: "مثال رسمي كامل. حلّ e^{2x}=e^{4}\\cdot e^{-x}. نكتب المعطى، نستخدم قانون الجمع، نوحّد الأس، ثم نعوّض للتحقق. لا تقفز إلى الناتج.",
        en: "A full official-style example. Solve e^{2x} = e^{4} · e^{-x}. Write the given, use the product rule, equate exponents, then substitute back. Do not jump to the number.",
      },
      canvas: {
        actions: [
          {
            at: 0,
            type: "clear",
            payload: {},
          },
          {
            at: 4,
            type: "show_equation",
            payload: {
              latex: "e^{2x}=e^{4}\\cdot e^{-x}",
              caption: { ar: "المسألة", en: "Given" },
            },
          },
          {
            at: 18,
            type: "show_step",
            payload: {
              latex: "e^{4}\\cdot e^{-x}=e^{4-x}",
              text: {
                ar: "الخطوة 1 — قانون الجمع في الأس.",
                en: "Step 1 — product rule for exponents.",
              },
            },
          },
          {
            at: 40,
            type: "show_step",
            payload: {
              latex: "e^{2x}=e^{4-x}",
              text: {
                ar: "الخطوة 2 — الدالة الأسية متباينة، فالأسنان متساويان.",
                en: "Step 2 — the exponential is one-to-one, so the exponents match.",
              },
            },
          },
          {
            at: 62,
            type: "show_step",
            payload: {
              latex: "2x=4-x \\Rightarrow 3x=4 \\Rightarrow x=\\dfrac{4}{3}",
              text: {
                ar: "الخطوة 3 — معادلة من الدرجة الأولى.",
                en: "Step 3 — a first-degree equation.",
              },
            },
          },
          {
            at: 88,
            type: "show_step",
            payload: {
              latex: "e^{2\\cdot 4/3}=e^{8/3},\\quad e^{4-4/3}=e^{8/3}",
              text: {
                ar: "الخطوة 4 — التحقق بالتعويض في الطرفين.",
                en: "Step 4 — substitute back into both sides.",
              },
            },
          },
          {
            at: 108,
            type: "show_equation",
            payload: {
              latex: "x=\\dfrac{4}{3}",
              caption: { ar: "الناتج في إطار", en: "Boxed answer" },
            },
          },
        ],
      },
    },
    {
      id: "common-mistake",
      start: 210,
      end: 240,
      phase: "common_mistake",
      avatar: { state: "speaking" },
      narration: {
        ar: "الخطأ الشائع في النماذج الرسمية: كتابة a^{x+y}=a^{x}+a^{y}. هذا جمع وليس ضرباً. إذا نسخت هذا السطر في الشهادة تخسر المسألة كلها. اكتب القانون الصحيح ثلاث مرات الليلة.",
        en: "The official-exam trap: writing a^{x+y} = a^x + a^y. That is addition, not multiplication. Copying that line in the certificate paper costs the whole question. Rewrite the true rule three times tonight.",
      },
      canvas: {
        actions: [
          {
            at: 2,
            type: "show_equation",
            payload: {
              latex: "a^{x+y}\\neq a^{x}+a^{y}",
              caption: { ar: "لا تكتب هذا", en: "Never write this" },
            },
          },
          {
            at: 12,
            type: "show_step",
            payload: {
              latex: "a^{x+y}=a^{x}a^{y}",
              text: {
                ar: "القانون الصحيح. تحقق دائماً عند x=1, y=1.",
                en: "The true rule. Check with x = 1, y = 1 every time.",
              },
            },
          },
        ],
      },
    },
  ],
};

export const complexNumbersLesson: LessonTimeline = {
  id: "ls-complex-numbers",
  topic: "Complex Numbers",
  track: "ls",
  grade: "Grade 12 · LS / GS",
  title: {
    ar: "الأعداد المركبة — المستوى العقدي",
    en: "Complex Numbers — the Argand plane",
  },
  language: "en",
  durationSec: 240,
  media: {
    poster: "/teachers/munzer.jpg",
  },
  segments: [
    {
      id: "intro",
      start: 0,
      end: 30,
      phase: "introduction",
      avatar: { state: "speaking" },
      narration: {
        ar: "الأعداد المركبة في الشهادة اللبنانية — خاصة علوم الحياة والعلوم العامة. كل عدد z=a+bi نقطة في المستوى. المعيار هو البعد عن الأصل. نعرّف، نرسم، ثم نضرب مثالين كما في النماذج.",
        en: "Complex numbers in the Lebanese Baccalaureate — especially LS and GS. Each z = a + bi is a point in the plane. The modulus is the distance from the origin. We define, we draw, then we multiply a full example.",
      },
      canvas: {
        actions: [
          {
            at: 3,
            type: "show_equation",
            payload: {
              latex: "z=a+bi,\\quad i^{2}=-1",
              caption: { ar: "تعريف", en: "Concept definition" },
            },
          },
          {
            at: 14,
            type: "show_step",
            payload: {
              latex: "|z|=\\sqrt{a^{2}+b^{2}}",
              text: {
                ar: "المعيار طول المتجه من الأصل إلى النقطة.",
                en: "The modulus is the length of the vector from the origin.",
              },
            },
          },
        ],
      },
    },
    {
      id: "rule-graph",
      start: 30,
      end: 90,
      phase: "rule_graph",
      avatar: { state: "paused" },
      narration: {
        ar: "أتوقف عند الرسم. z=3-4i في الربع الرابع. المعيار 5. الجذران لـ z^{2}+1=0 هما ±i على محور التخييل. لا تخلط المعيار مع الجزء الحقيقي.",
        en: "I freeze on the drawing. z = 3 − 4i sits in quadrant IV. The modulus is 5. The roots of z² + 1 = 0 are ±i on the imaginary axis. Do not confuse modulus with the real part.",
      },
      canvas: {
        actions: [
          {
            at: 0,
            type: "show_equation",
            payload: {
              latex: "|3-4i|=5",
              caption: { ar: "القاعدة على المستوى", en: "Rule on the Argand plane" },
            },
          },
          {
            at: 8,
            type: "render_graph",
            payload: {
              kind: "argand",
              xDomain: [-5, 5],
              yDomain: [-5, 5],
              title: { ar: "المستوى العقدي", en: "Argand plane" },
              points: [
                { x: 3, y: -4, kind: "point", label: { ar: "3−4i", en: "3 − 4i" } },
                { x: 0, y: 1, kind: "root", label: { ar: "i", en: "i" } },
                { x: 0, y: -1, kind: "root", label: { ar: "−i", en: "−i" } },
              ],
            },
          },
          {
            at: 22,
            type: "highlight_point",
            payload: {
              kind: "point",
              x: 3,
              y: -4,
              label: { ar: "z=3−4i", en: "z = 3 − 4i" },
            },
          },
          {
            at: 34,
            type: "highlight_point",
            payload: {
              kind: "root",
              x: 0,
              y: 1,
              label: { ar: "جذر z²+1=0", en: "Root of z² + 1 = 0" },
            },
          },
          {
            at: 46,
            type: "highlight_point",
            payload: {
              kind: "root",
              x: 0,
              y: -1,
              label: { ar: "الجذر الثاني −i", en: "The second root −i" },
            },
          },
        ],
      },
    },
    {
      id: "real-example",
      start: 90,
      end: 210,
      phase: "real_example",
      avatar: { state: "speaking" },
      narration: {
        ar: "مثال الضرب: (2+i)(3−i). نوزّع، نستبدل i² بـ −1، ثم نجمع الحقيقي مع التخيلي. بعد ذلك نحسب المعيار للتحقق.",
        en: "Multiplication example: (2 + i)(3 − i). Expand, replace i² by −1, collect real and imaginary parts. Then check with the modulus.",
      },
      canvas: {
        actions: [
          { at: 0, type: "clear", payload: {} },
          {
            at: 4,
            type: "show_equation",
            payload: {
              latex: "(2+i)(3-i)",
              caption: { ar: "المسألة", en: "Given" },
            },
          },
          {
            at: 16,
            type: "show_step",
            payload: {
              latex: "6-2i+3i-i^{2}",
              text: { ar: "الخطوة 1 — التوزيع.", en: "Step 1 — distribute." },
            },
          },
          {
            at: 40,
            type: "show_step",
            payload: {
              latex: "i^{2}=-1 \\Rightarrow -i^{2}=+1",
              text: { ar: "الخطوة 2 — استبدال i².", en: "Step 2 — replace i²." },
            },
          },
          {
            at: 64,
            type: "show_step",
            payload: {
              latex: "6+1+(-2i+3i)=7+i",
              text: { ar: "الخطوة 3 — جمع الحدود.", en: "Step 3 — collect terms." },
            },
          },
          {
            at: 92,
            type: "show_step",
            payload: {
              latex: "|7+i|=\\sqrt{50}=5\\sqrt{2}",
              text: {
                ar: "الخطوة 4 — تحقق بالمعيار: |z1||z2|=√5 · √10 = √50.",
                en: "Step 4 — modulus check: |z1||z2| = √5 · √10 = √50.",
              },
            },
          },
        ],
      },
    },
    {
      id: "common-mistake",
      start: 210,
      end: 240,
      phase: "common_mistake",
      avatar: { state: "speaking" },
      narration: {
        ar: "الخطأ الرسمي: |z1+z2|=|z1|+|z2| دائماً. المساواة صحيحة فقط إذا كان العددان على الشعاع نفسه. في الامتحان اكتب المتباينة |z1+z2| ≤ |z1|+|z2|.",
        en: "The official trap: claiming |z1 + z2| = |z1| + |z2| always. Equality holds only if the two numbers lie on the same ray. In the exam write the triangle inequality.",
      },
      canvas: {
        actions: [
          {
            at: 3,
            type: "show_equation",
            payload: {
              latex: "|z_1+z_2|\\le |z_1|+|z_2|",
              caption: { ar: "المتباينة الصحيحة", en: "The correct inequality" },
            },
          },
          {
            at: 14,
            type: "show_step",
            payload: {
              latex: "|z_1+z_2|\\neq |z_1|+|z_2|\\text{ in general}",
              text: {
                ar: "لا تستبدل المتباينة بمساواة إلا بعد التحقق من الاتجاه.",
                en: "Do not upgrade the inequality to equality without checking direction.",
              },
            },
          },
        ],
      },
    },
  ],
};

export const sampleLessons = {
  exponential: exponentialFunctionsLesson,
  complex: complexNumbersLesson,
};

export function getSampleLesson(id: string | null | undefined) {
  if (!id) return exponentialFunctionsLesson;
  const key = id.toLowerCase();
  if (key.includes("complex") || key.includes("مركب")) return complexNumbersLesson;
  return exponentialFunctionsLesson;
}
