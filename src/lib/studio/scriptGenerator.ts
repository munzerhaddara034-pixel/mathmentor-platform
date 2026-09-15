import { createId } from "@/lib/ids";
import { ensurePedagogy } from "./pedagogy";
import { complexNumbersLesson, exponentialFunctionsLesson } from "./sampleLessons";
import {
  certificateTrackSchema,
  lessonTimelineSchema,
  type CertificateTrack,
  type LessonLanguage,
  type LessonTimeline,
} from "./timeline";

function coerceTrack(track: string): CertificateTrack {
  const parsed = certificateTrackSchema.safeParse(track);
  return parsed.success ? parsed.data : "ls";
}

export type ScriptRequest = {
  topic: string;
  track: CertificateTrack | string;
  language: LessonLanguage;
  grade?: string;
};

export type ScriptResult = {
  timeline: LessonTimeline;
  source: "openai" | "template";
  warning?: string;
};

const TRACK_SCOPE: Record<string, { ar: string; en: string }> = {
  brevet: { ar: "الشهادة المتوسطة (Brevet)", en: "Brevet (Grade 9 certificate)" },
  ls: { ar: "الثانوية — علوم الحياة (LS)", en: "Baccalaureate Life Sciences (LS)" },
  se: { ar: "الثانوية — اجتماع واقتصاد (SE)", en: "Baccalaureate Sociology & Economics (SE)" },
  gs: { ar: "الثانوية — علوم عامة (GS)", en: "Baccalaureate General Sciences (GS)" },
  lh: { ar: "الثانوية — آداب وإنسانيات (LH)", en: "Baccalaureate Literature & Humanities (LH)" },
  eb7: { ar: "الصف السابع", en: "Grade 7 (EB7)" },
  eb8: { ar: "الصف الثامن", en: "Grade 8 (EB8)" },
  s1: { ar: "السنة الأولى ثانوي", en: "Secondary Year 1" },
  sat: { ar: "رياضيات SAT", en: "SAT Math" },
};

function scopeFor(track: string) {
  return TRACK_SCOPE[track] ?? TRACK_SCOPE.ls;
}

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim() || "";
}

function detectPack(topic: string): "exponential" | "complex" | "quadratic" | "generic" {
  const t = topic.toLowerCase();
  if (/complex|مركب|مركّب|argand|تخييل/.test(t)) return "complex";
  if (/exp|أسي|اسي|exponential|e\^|نمو/.test(t)) return "exponential";
  if (/quad|تربيع|parabola|درجة ثانية|x\^2/.test(t)) return "quadratic";
  return "generic";
}

function cloneTimeline(base: LessonTimeline, request: ScriptRequest): LessonTimeline {
  const scope = scopeFor(String(request.track));
  const grade = request.grade?.trim() || base.grade || "";
  return ensurePedagogy({
    ...base,
    id: createId("script"),
    topic: request.topic,
    track: coerceTrack(String(request.track)),
    grade,
    language: request.language,
    title: {
      ar: `${request.topic} — ${scope.ar}${grade ? ` · ${grade}` : ""}`,
      en: `${request.topic} — ${scope.en}${grade ? ` · ${grade}` : ""}`,
    },
  });
}

function quadraticLesson(request: ScriptRequest): LessonTimeline {
  const scope = scopeFor(String(request.track));
  return ensurePedagogy({
    id: createId("script"),
    topic: request.topic,
    track: coerceTrack(String(request.track)),
    grade: request.grade,
    language: request.language,
    durationSec: 240,
    title: {
      ar: `${request.topic} — ${scope.ar}`,
      en: `${request.topic} — ${scope.en}`,
    },
    media: { poster: "/teachers/munzer.jpg" },
    segments: [
      {
        id: "intro",
        start: 0,
        end: 30,
        phase: "introduction",
        avatar: { state: "speaking" },
        narration: {
          ar: `نعرّف ${request.topic} في ${scope.ar}. الدالة التربيعية y=ax^2+bx+c تظهر في النماذج مع الجذور والرأس.`,
          en: `We define ${request.topic} for ${scope.en}. The quadratic y = ax² + bx + c appears with roots and a vertex.`,
        },
        canvas: {
          actions: [
            {
              at: 3,
              type: "show_equation",
              payload: {
                latex: "f(x)=ax^{2}+bx+c",
                caption: { ar: "تعريف", en: "Concept definition" },
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
          ar: "نتوقف عند الرسم y=(x-1)(x-3). الجذران 1 و3. الرأس (النهاية الصغرى) عند x=2.",
          en: "We freeze on y = (x − 1)(x − 3). Roots 1 and 3. The vertex (minimum) is at x = 2.",
        },
        canvas: {
          actions: [
            {
              at: 4,
              type: "render_graph",
              payload: {
                kind: "function",
                fn: "(x-1)*(x-3)",
                xDomain: [-1, 5],
                yDomain: [-5, 8],
                title: { ar: "y=(x-1)(x-3)", en: "y = (x − 1)(x − 3)" },
              },
            },
            {
              at: 16,
              type: "highlight_point",
              payload: {
                kind: "root",
                x: 1,
                y: 0,
                label: { ar: "جذر x=1", en: "Root x = 1" },
              },
            },
            {
              at: 26,
              type: "highlight_point",
              payload: {
                kind: "root",
                x: 3,
                y: 0,
                label: { ar: "جذر x=3", en: "Root x = 3" },
              },
            },
            {
              at: 38,
              type: "highlight_point",
              payload: {
                kind: "extrema",
                x: 2,
                y: -1,
                label: { ar: "نهاية صغرى (2,−1)", en: "Minimum (2, −1)" },
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
          ar: "حل x^2-4x+3=0 بالتحليل ثم تحقق بالتعويض.",
          en: "Solve x² − 4x + 3 = 0 by factoring, then substitute back.",
        },
        canvas: {
          actions: [
            {
              at: 4,
              type: "show_equation",
              payload: {
                latex: "x^{2}-4x+3=0",
                caption: { ar: "المسألة", en: "Given" },
              },
            },
            {
              at: 16,
              type: "show_step",
              payload: {
                latex: "(x-1)(x-3)=0",
                text: { ar: "الخطوة 1 — التحليل.", en: "Step 1 — factor." },
              },
            },
            {
              at: 40,
              type: "show_step",
              payload: {
                latex: "x=1 \\text{ or } x=3",
                text: { ar: "الخطوة 2 — الجذران.", en: "Step 2 — the roots." },
              },
            },
            {
              at: 70,
              type: "show_step",
              payload: {
                latex: "1-4+3=0,\\quad 9-12+3=0",
                text: { ar: "الخطوة 3 — التعويض.", en: "Step 3 — substitution check." },
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
          ar: "خطأ شائع: نسيان إشارة b في الرأس x=-b/(2a).",
          en: "Common trap: dropping the sign of b in x = −b/(2a).",
        },
        canvas: {
          actions: [
            {
              at: 3,
              type: "show_equation",
              payload: {
                latex: "x_{v}=-\\dfrac{b}{2a}",
                caption: { ar: "لا تسقط الإشارة", en: "Keep the minus" },
              },
            },
            {
              at: 12,
              type: "show_step",
              payload: {
                latex: "a=1,\\; b=-4 \\Rightarrow x_v=2",
                text: {
                  ar: "b سالبة هنا، فالرأس عند 2 وليس −2.",
                  en: "Here b is negative, so the vertex is at 2, not −2.",
                },
              },
            },
          ],
        },
      },
    ],
  });
}

function genericLesson(request: ScriptRequest): LessonTimeline {
  const scope = scopeFor(String(request.track));
  const topic = request.topic.trim();
  const safe = topic.replace(/[\\{}]/g, "");
  return ensurePedagogy({
    id: createId("script"),
    topic,
    track: coerceTrack(String(request.track)),
    grade: request.grade,
    language: request.language,
    durationSec: 240,
    title: {
      ar: `${topic} — ${scope.ar}`,
      en: `${topic} — ${scope.en}`,
    },
    media: { poster: "/teachers/munzer.jpg" },
    segments: [
      {
        id: "intro",
        start: 0,
        end: 30,
        phase: "introduction",
        avatar: { state: "speaking" },
        narration: {
          ar: `درس ${topic} وفق ${scope.ar}. نبدأ بالتعريف ثم القانون والرسم ثم مثال محلول ثم الخطأ الشائع في النماذج الرسمية.`,
          en: `A lesson on ${topic} for ${scope.en}. We start with the definition, then the rule and graph, then a worked example, then the official-exam trap.`,
        },
        canvas: {
          actions: [
            {
              at: 3,
              type: "show_equation",
              payload: {
                latex: `\\text{${safe}}`,
                caption: { ar: "تعريف الفكرة ونطاق الامتحان", en: "Idea and exam scope" },
              },
            },
            {
              at: 14,
              type: "show_step",
              payload: {
                latex: "\\text{given }\\to\\text{ rule }\\to\\text{ check}",
                text: {
                  ar: "أربع أسطر: معطى، قانون، خطوات، تحقق.",
                  en: "Four lines: given, rule, steps, check.",
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
          ar: `نتوقف عن حركة الصورة لنرسم نموذجاً مرتبطاً بـ ${topic}. نعلّم التقارب عند الحاجة.`,
          en: `We freeze the avatar to graph a model tied to ${topic}. We mark an asymptote when it applies.`,
        },
        canvas: {
          actions: [
            {
              at: 5,
              type: "render_graph",
              payload: {
                kind: "function",
                fn: "exp(x)",
                xDomain: [-2, 2],
                yDomain: [-1, 8],
                title: { ar: `نموذج لـ ${topic}`, en: `Model for ${topic}` },
              },
            },
            {
              at: 18,
              type: "highlight_point",
              payload: {
                kind: "asymptote",
                axis: "y",
                value: 0,
                label: { ar: "تقارب إن وُجد", en: "Asymptote if present" },
              },
            },
            {
              at: 32,
              type: "highlight_point",
              payload: {
                kind: "point",
                x: 0,
                y: 1,
                label: { ar: "نقطة تحقق", en: "Check point" },
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
          ar: `مثال محلول: إذا كانت الكمية تبدأ بـ 5 وتُضرب بـ e^x، احسب القيمة عند x=0 ثم x=1، وتحقق بالتعويض.`,
          en: `Worked example: a quantity starts at 5 and follows e^x. Evaluate at x = 0 and x = 1, then substitute back.`,
        },
        canvas: {
          actions: [
            {
              at: 4,
              type: "show_equation",
              payload: {
                latex: "Q(x)=5e^{x}",
                caption: { ar: "المسألة", en: "Given" },
              },
            },
            {
              at: 18,
              type: "show_step",
              payload: {
                latex: "Q(0)=5e^{0}=5",
                text: { ar: "الخطوة 1 — التعويض x=0.", en: "Step 1 — substitute x = 0." },
              },
            },
            {
              at: 48,
              type: "show_step",
              payload: {
                latex: "Q(1)=5e",
                text: { ar: "الخطوة 2 — التعويض x=1.", en: "Step 2 — substitute x = 1." },
              },
            },
            {
              at: 80,
              type: "show_step",
              payload: {
                latex: "Q(1)/Q(0)=e",
                text: {
                  ar: "الخطوة 3 — النسبة تتحقق من القانون.",
                  en: "Step 3 — the ratio checks the rule.",
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
          ar: `الخطأ الشائع في ${scope.ar}: حفظ الشعار دون شرط المجال. اكتب الشرط قبل القانون.`,
          en: `The typical ${scope.en} trap: quoting the slogan without the domain condition. Write the hypothesis before the formula.`,
        },
        canvas: {
          actions: [
            {
              at: 3,
              type: "show_equation",
              payload: {
                latex: "\\text{hypothesis first, then the rule}",
                caption: { ar: "شرط ثم قانون", en: "Hypothesis then rule" },
              },
            },
            {
              at: 12,
              type: "show_step",
              payload: {
                text: {
                  ar: `لا تخلط ${topic} مع قانون الجار دون تحقق.`,
                  en: `Do not mix ${topic} with a neighbouring rule without a check.`,
                },
              },
            },
          ],
        },
      },
    ],
  });
}

export function buildTemplateScript(request: ScriptRequest): LessonTimeline {
  const pack = detectPack(request.topic);
  if (pack === "complex") return cloneTimeline(complexNumbersLesson, request);
  if (pack === "exponential") return cloneTimeline(exponentialFunctionsLesson, request);
  if (pack === "quadratic") return quadraticLesson(request);
  return genericLesson(request);
}

const SYSTEM_PROMPT = `You are Professor Munzer Haddara's lesson-script writer for MathMentor, a Lebanese Secondary & Brevet mathematics platform.

Return ONE JSON object only, matching this schema:
{
  "id": string,
  "title": { "ar": string, "en": string },
  "language": "ar" | "en",
  "durationSec": number,
  "track": string,
  "grade": string,
  "topic": string,
  "segments": [
    {
      "id": string,
      "start": number,
      "end": number,
      "phase": "introduction" | "rule_graph" | "real_example" | "common_mistake",
      "narration": { "ar": string, "en": string },
      "avatar": { "state": "speaking" | "paused" },
      "canvas": {
        "actions": [
          {
            "at": number,
            "type": "show_equation" | "render_graph" | "highlight_point" | "show_step" | "clear",
            "payload": object
          }
        ]
      }
    }
  ]
}

Hard rules:
1. ALWAYS include exactly these four phases in order, with durations about 30s, 60s, 120s, 30s (total ~240s).
2. introduction: concept definition + Lebanese exam scope (Brevet / LS / SE / GS / LH as relevant). Canvas: show_equation.
3. rule_graph: state the rule. MUST include a canvas action type "render_graph" (Render Graph). Set avatar.state to "paused". Highlight roots, asymptotes, extrema when they apply using highlight_point { kind: "root"|"asymptote"|"extrema", ... }. payload.fn must be a JS/math expression in x such as "exp(x)" or "(x-1)*(x-3)".
4. real_example: a full worked problem with substitution. MUST include two or more type "show_step" actions (Show Step-by-Step Equations) with latex and bilingual text.
5. common_mistake: a typical official-exam error warning (~30s).
6. "at" is seconds from the start of THAT segment, not absolute time.
7. Write narration the professor would actually speak. Real math, not placeholders.
8. Bilingual ar + en on every title, narration, caption, and step text.`;

async function generateWithOpenAI(request: ScriptRequest): Promise<LessonTimeline> {
  const key = openaiKey();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const scope = scopeFor(String(request.track));
  const user = JSON.stringify({
    topic: request.topic,
    track: request.track,
    trackLabel: scope,
    language: request.language,
    grade: request.grade ?? "",
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty script.");

  const parsedJson: unknown = JSON.parse(content);
  const parsed = lessonTimelineSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`OpenAI JSON failed schema: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return ensurePedagogy(parsed.data);
}

export async function generateLessonScript(request: ScriptRequest): Promise<ScriptResult> {
  const topic = request.topic.trim();
  if (!topic) {
    throw new Error("topic is required");
  }

  if (openaiKey()) {
    try {
      const timeline = await generateWithOpenAI({ ...request, topic });
      return { timeline, source: "openai" };
    } catch (error) {
      const timeline = buildTemplateScript({ ...request, topic });
      return {
        timeline,
        source: "template",
        warning: error instanceof Error ? error.message : "OpenAI failed; used template script.",
      };
    }
  }

  return {
    timeline: buildTemplateScript({ ...request, topic }),
    source: "template",
    warning: "No OPENAI_API_KEY (or LLM_API_KEY). Returned a deterministic four-phase template with real math.",
  };
}
