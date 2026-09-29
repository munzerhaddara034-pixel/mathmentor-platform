/**
 * Pedagogical AI tutor — Direct vs Socratic modes across curricula.
 * Reuses Gemini / OpenAI patterns from the math solver; falls back to demos.
 * Branding: Prof. Munzer Haddara / الأستاذ منذر حداره.
 */

import { z } from "zod";
import { INSTRUCTOR_LINE, SOLVER_SYSTEM_PROMPT } from "@/lib/pedagogy/lebanese";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import { geminiApiKey, openaiSolverKey } from "@/lib/solver/llm";
import { getCurriculum } from "./catalogs";
import { terminologyFor } from "./terminology";
import type { CurriculumId, CurriculumLanguage } from "./types";
export type {
  TutorMode,
  TutorStep,
  TutorHint,
  PedagogicalTutorResult,
  PedagogicalTutorRequest,
} from "./tutorTypes";
import type {
  TutorMode,
  TutorStep,
  TutorHint,
  PedagogicalTutorResult,
  PedagogicalTutorRequest,
} from "./tutorTypes";


const DEMO_PRESSURE_WARNING_EN =
  "The server is under temporary load, so an approximate practice model is shown. Try again in a moment for a full AI solution.";
const DEMO_PRESSURE_WARNING_AR =
  "السيرفر تحت ضغط مؤقت، ويتم توليد نموذج تقريبي للتدريب. أعد المحاولة بعد لحظات للحصول على حل الذكاء الكامل.";
const BACKUP_MODEL_WARNING_EN =
  "A backup practice model was used. The solution is still curriculum-aligned.";
const BACKUP_MODEL_WARNING_AR =
  "تم استخدام نموذج تدريب احتياطي. الحل ما زال متوافقاً مع المنهج.";

/** Student-facing Demo notice — never expose raw Gemini/OpenAI error JSON. */
function applyDemoPressureNotice(
  demo: PedagogicalTutorResult,
  _technical?: string,
): PedagogicalTutorResult {
  demo.warning = DEMO_PRESSURE_WARNING_EN;
  demo.warningAr = DEMO_PRESSURE_WARNING_AR;
  return demo;
}

function applyBackupModelNotice(result: PedagogicalTutorResult): PedagogicalTutorResult {
  result.warning = BACKUP_MODEL_WARNING_EN;
  result.warningAr = BACKUP_MODEL_WARNING_AR;
  return result;
}

const tutorJsonSchema = z.object({
  curriculumObjective: z.string(),
  prerequisiteConcept: z.string(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        justification: z.string(),
        latex: z.string().optional(),
      }),
    )
    .min(1),
  finalAnswer: z.string(),
  finalAnswerLatex: z.string().optional(),
  hints: z
    .array(
      z.object({
        level: z.number(),
        text: z.string(),
        latex: z.string().optional(),
      }),
    )
    .optional(),
});

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Tutor model did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

function geminiModels(): string[] {
  const pinned = process.env.GEMINI_MODEL?.trim();
  const fallbacks = [
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
  ];
  if (!pinned) return fallbacks;
  return [pinned, ...fallbacks.filter((model) => model !== pinned)];
}

function buildSystemPrompt(req: PedagogicalTutorRequest): string {
  const curriculum = getCurriculum(req.curriculumId);
  const terms = terminologyFor(req.curriculumId);
  const modeBlock =
    req.mode === "socratic"
      ? `MODE: Socratic. Return progressive hints (level 1 = gentle nudge, level 3 = nearly the next step). Do NOT put the full final answer in hints. Set finalAnswer only if revealAnswer is true; otherwise put a short "ask me to reveal" note in finalAnswer and leave finalAnswerLatex empty.`
      : `MODE: Direct. Full justified solution with every theorem named. Box the final answer.`;

  return `${SOLVER_SYSTEM_PROMPT}

You are the pedagogical tutor for MathMentor (${INSTRUCTOR_LINE}).
Curriculum: ${curriculum.labelEn} / ${curriculum.labelAr} (id=${curriculum.id}).
Use curriculum terminology:
- Derivative: ${terms.derivative.en} / ${terms.derivative.ar}
- Limits: ${terms.limits.en} / ${terms.limits.ar}
- Domain: ${terms.domain.en} / ${terms.domain.ar}
Language for all prose: ${req.language === "ar" ? "Arabic" : "English"}.
MANDATORY FORMULA FORMATTING (KaTeX / Word Equation Standard):
- NEVER output inline slash fractions (e.g. 1/2, a/b). You MUST use vertical fractions: \\frac{numerator}{denominator}.
- Explicitly wrap all exponents in curly braces: x^{2}, e^{2x+1}. Never emit bare caret notation in plain text.
- Use full radical notation: \\sqrt{expression}.
- Use explicit display limits: \\lim\\limits_{x \\to a} and \\int\\limits_{a}^{b}.
revealAnswer=${req.revealAnswer === true}
Return ONLY JSON:
{
  "curriculumObjective": string,
  "prerequisiteConcept": string,
  "steps": [{"title": string, "justification": string, "latex"?: string}],
  "finalAnswer": string,
  "finalAnswerLatex"?: string,
  "hints": [{"level": number, "text": string, "latex"?: string}]
}`;
}

function demoTutor(req: PedagogicalTutorRequest): PedagogicalTutorResult {
  const curriculum = getCurriculum(req.curriculumId);
  const terms = terminologyFor(req.curriculumId);
  const sample = curriculum.samples[0];
  const lang = req.language;
  const ar = lang === "ar";
  const latex = formatLebaneseEquation(req.latex || sample?.sampleLatex || "x^{2}-5x+6=0");
  const reveal = req.mode === "direct" || req.revealAnswer === true;
  const problemBlob = `${req.text ?? ""} ${req.latex ?? ""}`.toLowerCase();
  const latexRaw = req.latex ?? "";
  const isLnOverX =
    /\\frac\{\\ln/.test(latexRaw) ||
    /ln\(x\)\s*\/\s*x/.test(problemBlob) ||
    /\\frac\{\\ln\(x\)\}\{x\}/.test(latexRaw);
  const isClassicRational =
    /x\^\{2\}-3x\+2/.test(latexRaw) ||
    /\(x\^2-3x\+2\)\/\(x-1\)/.test(problemBlob) ||
    /x\^2\s*-\s*3x\s*\+\s*2/.test(problemBlob);


  const objective =
    ar
      ? sample?.objectiveAr || `هدف ${curriculum.labelAr}: تطبيق ${terms.derivative.ar} و${terms.limits.ar} بمنهجية رسمية.`
      : sample?.objectiveEn || `${curriculum.labelEn} objective: apply ${terms.derivative.en} and ${terms.limits.en} with full justification.`;

  const prereq =
    ar
      ? sample?.prerequisiteAr || "التبسيط الجبري ومعرفة مجموعة التعريف."
      : sample?.prerequisiteEn || "Algebraic simplification and domain awareness.";

  const steps: TutorStep[] =
    req.curriculumId === "sat"
      ? [
          {
            title: ar ? "وسّع الأقواس" : "Expand",
            justification: ar ? "وزّع 3 على (x-2)." : "Distribute 3 over (x-2).",
            latex: "3x-6+5=2x+9",
          },
          {
            title: ar ? "اجمع الحدود" : "Collect like terms",
            justification: ar ? "انقل 2x إلى اليسار والثوابت إلى اليمين." : "Move 2x left and constants right.",
            latex: "3x-2x=9+6-5",
          },
          {
            title: ar ? "بسّط" : "Simplify",
            justification: ar ? "x=10." : "x equals 10.",
            latex: "x=10",
          },
        ]
      : isClassicRational
        ? [
            {
              title: ar ? terms.domain.ar : terms.domain.en,
              justification: ar
                ? "المقام ينعدم عند x=1، إذن D_f=\\mathbb{R}\\setminus\\{1\\}."
                : "Denominator vanishes at x=1, so D_f=\\mathbb{R}\\setminus\\{1\\}.",
              latex: "D_f=\\mathbb{R}\\setminus\\{1\\}",
            },
            {
              title: ar ? "تبسيط الجبر" : "Algebraic simplification",
              justification: ar
                ? "حلّل البسط: x^{2}-3x+2=(x-1)(x-2)، ثم اختصر لـ x\\neq 1."
                : "Factor numerator: x^{2}-3x+2=(x-1)(x-2), then cancel for x\\neq 1.",
              latex: "f(x)=\\frac{(x-1)(x-2)}{x-1}=x-2\\quad(x\\neq 1)",
            },
            {
              title: ar ? terms.limits.ar : terms.limits.en,
              justification: ar
                ? "بعد التبسيط f(x)=x-2 (x\\neq 1): المستقيم y=x-2 يصف سلوك الدالة، وعند x\\to 1 توجد فجوة قابلة للإزالة والنهاية تساوي -1."
                : "After canceling, f(x)=x-2 (x\\neq 1): oblique/identity line y=x-2; removable hole at x=1.",
              latex: "\\lim\\limits_{x \\to 1} f(x)= -1\\quad;\\quad y=x-2",
            },
            {
              title: ar ? terms.derivative.ar : terms.derivative.en,
              justification: ar
                ? "بعد التبسيط f(x)=x-2 على D_f، فالمشتقة ثابتة f'(x)=1 وإشارة المشتقة موجبة دائماً."
                : "On D_f, f(x)=x-2 so f'(x)=1 and the derivative is always positive.",
              latex: "f'(x)=1",
            },
            {
              title: ar ? terms.variationTable.ar : terms.variationTable.en,
              justification: ar
                ? "الدالة متزايدة على كل مجال من مجالي التعريف مع فجوة عند x=1."
                : "f is increasing on each connected component of D_f, with a hole at x=1.",
              latex: "f\\nearrow\\text{ on }(-\\infty,1)\\cup(1,+\\infty)",
            },
            {
              title: ar ? terms.finalAnswer.ar : terms.finalAnswer.en,
              justification: ar ? "الجواب في إطار كأوراق الشهادة." : "Box the answer as on official papers.",
              latex: "D_f=\\mathbb{R}\\setminus\\{1\\},\\; f(x)=x-2\\ (x\\neq 1),\\; f'(x)=1",
            },
          ]
        : isLnOverX
          ? [
              {
                title: ar ? terms.domain.ar : terms.domain.en,
                justification: ar
                  ? "\\ln(x) معرّف لـ x>0 والمقام x\\neq 0، فـ D_f=(0,+\\infty)."
                  : "\\ln(x) needs x>0 and denominator x\\neq 0, so D_f=(0,+\\infty).",
                latex: "D_f=(0,+\\infty)",
              },
              {
                title: ar ? terms.limits.ar : terms.limits.en,
                justification: ar
                  ? "ادرس النهايات عند 0^{+} وعند +\\infty؛ يظهر مستقيم مقارب عمودي x=0 ونهاية أفقية y=0."
                  : "Study limits at 0^{+} and +\\infty; vertical asymptote x=0 and horizontal y=0.",
                latex: "\\lim\\limits_{x \\to 0^{+}}\\frac{\\ln x}{x}=-\\infty\\quad;\\quad \\lim\\limits_{x \\to +\\infty}\\frac{\\ln x}{x}=0",
              },
              {
                title: ar ? terms.derivative.ar : terms.derivative.en,
                justification: ar
                  ? "قاعدة القسمة: f'(x)=\\frac{1-\\ln x}{x^{2}}."
                  : "Quotient rule: f'(x)=\\frac{1-\\ln x}{x^{2}}.",
                latex: "f'(x)=\\frac{1-\\ln x}{x^{2}}",
              },
              {
                title: ar ? terms.variationTable.ar : terms.variationTable.en,
                justification: ar
                  ? "إشارة f' تتبع 1-\\ln x: تزايد على (0,e) وتناقص على (e,+\\infty)، قيمة عظمى عند x=e."
                  : "Sign of f' follows 1-\\ln x: increase on (0,e), decrease on (e,+\\infty), max at x=e.",
                latex: "f'(x)=0\\iff x=e\\quad;\\quad f(e)=\\frac{1}{e}",
              },
              {
                title: ar ? terms.finalAnswer.ar : terms.finalAnswer.en,
                justification: ar ? "الجواب في إطار كأوراق الشهادة." : "Box the answer as on official papers.",
                latex: "D_f=(0,+\\infty),\\; f'(x)=\\frac{1-\\ln x}{x^{2}},\\; \\max=(\\mathrm{e},\\frac{1}{\\mathrm{e}})",
              },
            ]
          : [
              {
                title: ar ? terms.domain.ar : terms.domain.en,
                justification: ar
                  ? "استبعد قيم x التي تجعل المقام صفراً قبل أي نهاية."
                  : "Exclude zeros of the denominator before any limit.",
                latex: "D_f=\\mathbb{R}\\setminus\\{-2,2\\}",
              },
              {
                title: ar ? terms.limits.ar : terms.limits.en,
                justification: ar
                  ? "قسّم البسط والمقام على أعلى قوة ثم عيّن المستقيم المقارب الأفقي y=2."
                  : "Divide by the highest power, then name the horizontal asymptote y=2.",
                latex: latex.includes("lim") ? latex : `\\lim\\limits_{x \\to +\\infty} ${latex}`,
              },
              {
                title: ar ? terms.finalAnswer.ar : terms.finalAnswer.en,
                justification: ar ? "الجواب في إطار كأوراق الشهادة." : "Box the answer as on official papers.",
                latex: "y=2",
              },
            ];

  const hints: TutorHint[] = isClassicRational
    ? [
        {
          level: 1,
          text: ar ? `ابدأ بـ ${terms.domain.ar}: أين ينعدم المقام؟` : `Start from ${terms.domain.en}: where does the denominator vanish?`,
        },
        {
          level: 2,
          text: ar ? "هل يمكن تحليل البسط x^{2}-3x+2؟" : "Can you factor x^{2}-3x+2?",
          latex: "x^{2}-3x+2=(x-1)(x-2)",
        },
        {
          level: 3,
          text: ar ? "بعد الاختصار، ما صورة f على D_f؟ ثم اشتق." : "After canceling, what is f on D_f? Then differentiate.",
          latex: "f(x)=x-2\\quad(x\\neq 1)",
        },
      ]
    : isLnOverX
      ? [
          {
            level: 1,
            text: ar ? `ما ${terms.domain.ar} لـ \\frac{\\ln(x)}{x}؟` : `What is the ${terms.domain.en} of \\frac{\\ln(x)}{x}?`,
          },
          {
            level: 2,
            text: ar ? "ادرس النهايات عند 0^{+} وعند +∞ قبل المشتقة." : "Study limits at 0^{+} and +∞ before differentiating.",
            latex: "\\lim\\limits_{x \\to 0^{+}}\\frac{\\ln x}{x}",
          },
          {
            level: 3,
            text: ar ? "طبّق قاعدة القسمة؛ إشارة f' تتبع 1-\\ln x." : "Use the quotient rule; the sign of f' follows 1-\\ln x.",
            latex: "f'(x)=\\frac{1-\\ln x}{x^{2}}",
          },
        ]
      : [
          {
            level: 1,
            text: ar ? `فكّر أولاً بـ ${terms.domain.ar}.` : `Start from the ${terms.domain.en}.`,
          },
          {
            level: 2,
            text: ar ? `ما الصيغة غير المعيّنة؟ أعد الكتابة قبل التعويض.` : `Name the indeterminate form, then rewrite before substituting.`,
          },
          {
            level: 3,
            text: ar ? `اقترب من خطوة القسمة على أعلى قوة.` : `You are one rewrite away from dividing by the leading power.`,
            latex: "\\frac{2+\\frac{1}{x^{2}}}{1-\\frac{4}{x^{2}}}",
          },
        ];

  const finalLatex = reveal
    ? req.curriculumId === "sat"
      ? "x=10"
      : isClassicRational
        ? "D_f=\\mathbb{R}\\setminus\\{1\\},\\; f(x)=x-2\\ (x\\neq 1),\\; f\'(x)=1"
        : isLnOverX
          ? "D_f=(0,+\\infty),\\; f\'(x)=\\frac{1-\\ln x}{x^{2}},\\; \\max=(\\mathrm{e},\\frac{1}{\\mathrm{e}})"
          : "y=2"
    : "";
  const finalAnswer = reveal
    ? ar
      ? req.curriculumId === "sat"
        ? "x = 10"
        : isClassicRational
          ? "D_f = ℝ\\{1} ، وبعد الاختصار f(x)=x-2 مع f'(x)=1"
          : isLnOverX
            ? "D_f=(0,+∞)، المشتقة f'(x)=\\frac{1-\\ln x}{x^{2}}، قيمة عظمى عند e"
            : "المستقيم المقارب الأفقي: y = 2"
      : req.curriculumId === "sat"
        ? "x = 10"
        : isClassicRational
          ? "D_f = R\\{1}; after canceling, f(x)=x-2 with f'(x)=1"
          : isLnOverX
            ? "D_f=(0,+∞); f'(x)=\\frac{1-\\ln x}{x^{2}}; maximum at x=e"
            : "Horizontal asymptote: y = 2"
    : ar
      ? "وضع سقراطي: اطلب كشف الجواب عندما تكون جاهزاً."
      : "Socratic mode: ask to reveal the answer when ready.";

  const base: PedagogicalTutorResult = {
    ok: true,
    mode: req.mode,
    curriculumId: req.curriculumId,
    language: lang,
    curriculumObjective: objective,
    prerequisiteConcept: prereq,
    steps: req.mode === "socratic" && !reveal ? steps.slice(0, 1) : steps,
    finalAnswer,
    finalAnswerLatex: formatLebaneseEquation(finalLatex),
    hints: req.mode === "socratic" ? hints : [],
    revealAnswer: reveal,
    source: "demo",
    voiceHook: "Voice dictation: POST /api/voice-math (Whisper when OPENAI_API_KEY is set). Pass transcript as text here.",
    imageStatus: req.imageBase64 ? "stub" : "none",
  };
  return applyDemoPressureNotice(base);
}

function normalizeResult(
  parsed: z.infer<typeof tutorJsonSchema>,
  req: PedagogicalTutorRequest,
  source: PedagogicalTutorResult["source"],
  imageStatus: PedagogicalTutorResult["imageStatus"],
): PedagogicalTutorResult {
  const reveal = req.mode === "direct" || req.revealAnswer === true;
  const steps = parsed.steps.map((step) => ({
    title: step.title,
    justification: step.justification,
    latex: step.latex ? formatLebaneseEquation(step.latex) : undefined,
  }));
  const hints = (parsed.hints ?? []).map((hint) => ({
    level: hint.level,
    text: hint.text,
    latex: hint.latex ? formatLebaneseEquation(hint.latex) : undefined,
  }));
  const finalLatex = reveal ? formatLebaneseEquation(parsed.finalAnswerLatex || parsed.finalAnswer || "") : "";
  return {
    ok: true,
    mode: req.mode,
    curriculumId: req.curriculumId,
    language: req.language,
    curriculumObjective: parsed.curriculumObjective,
    prerequisiteConcept: parsed.prerequisiteConcept,
    steps,
    finalAnswer: reveal
      ? parsed.finalAnswer
      : req.language === "ar"
        ? "وضع سقراطي: اطلب كشف الجواب عندما تكون جاهزاً."
        : "Socratic mode: ask to reveal the answer when ready.",
    finalAnswerLatex: finalLatex,
    hints: req.mode === "socratic" ? hints : [],
    revealAnswer: reveal,
    source,
    voiceHook: "Voice dictation: POST /api/voice-math (Whisper when OPENAI_API_KEY is set). Pass transcript as text here.",
    imageStatus,
  };
}

async function callGemini(req: PedagogicalTutorRequest): Promise<PedagogicalTutorResult> {
  const key = geminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const userText = [
    req.latex ? `LaTeX: ${req.latex}` : "",
    req.text ? `Problem: ${req.text}` : "",
    `Curriculum: ${req.curriculumId}`,
    `Mode: ${req.mode}`,
    `Language: ${req.language}`,
    `revealAnswer: ${req.revealAnswer === true}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Array<Record<string, unknown>> = [{ text: `${buildSystemPrompt(req)}\n\n${userText || "Solve from the image."}` }];
  let imageStatus: PedagogicalTutorResult["imageStatus"] = "none";
  if (req.imageBase64) {
    parts.push({
      inline_data: {
        mime_type: req.mimeType || "image/jpeg",
        data: req.imageBase64.replace(/^data:[^;]+;base64,/, ""),
      },
    });
    imageStatus = "used";
  }

  let lastError = "Gemini request failed.";
  for (const model of geminiModels()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
        // Fail over quickly when a model is overloaded or unreachable.
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        // 404 = unknown model for this key; 503/429 = overloaded — skip to next model fast.
        lastError = `Gemini ${model} ${response.status}: ${(await response.text()).slice(0, 240)}`;
        continue;
      }
      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
      const parsed = tutorJsonSchema.parse(extractJson(text));
      return normalizeResult(parsed, req, "gemini", imageStatus);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      lastError = msg.includes("abort") || msg.includes("Timeout")
        ? `Gemini ${model} timed out (12s).`
        : msg;
      // Timeout / network — try next model immediately.
      continue;
    }
  }
  throw new Error(lastError);
}

async function callOpenAI(req: PedagogicalTutorRequest): Promise<PedagogicalTutorResult> {
  const key = openaiSolverKey();
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(req) },
        {
          role: "user",
          content: `${req.latex ?? ""}\n${req.text ?? ""}${req.imageBase64 ? "\n[image attached as base64 — Vision not wired on OpenAI path; use Gemini for photos]" : ""}`,
        },
      ],
    }),
    // OpenAI often has no credits — fail fast and let demo/Gemini path win.
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = tutorJsonSchema.parse(JSON.parse(json.choices?.[0]?.message?.content ?? "{}"));
  return normalizeResult(parsed, req, "openai", req.imageBase64 ? "stub" : "none");
}

export async function runPedagogicalTutor(req: PedagogicalTutorRequest): Promise<PedagogicalTutorResult> {
  if (!req.text?.trim() && !req.latex?.trim() && !req.imageBase64) {
    throw new Error("Provide text, LaTeX, or an image.");
  }
  if (geminiApiKey()) {
    try {
      return await callGemini(req);
    } catch (error) {
      const technical = error instanceof Error ? error.message : "Gemini failed.";
      if (openaiSolverKey()) {
        try {
          const result = await callOpenAI(req);
          return applyBackupModelNotice(result);
        } catch (openAiError) {
          const demo = demoTutor(req);
          const tech2 = openAiError instanceof Error ? openAiError.message : "openai";
          return applyDemoPressureNotice(demo, `${technical}; ${tech2}`);
        }
      }
      const demo = demoTutor(req);
      if (req.imageBase64) demo.imageStatus = "stub";
      return applyDemoPressureNotice(demo, technical);
    }
  }
  if (openaiSolverKey()) {
    try {
      return await callOpenAI(req);
    } catch (error) {
      const demo = demoTutor(req);
      return applyDemoPressureNotice(
        demo,
        error instanceof Error ? error.message : "error",
      );
    }
  }
  return demoTutor(req);
}
