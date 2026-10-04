import { createId } from "@/lib/ids";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import {
  blueprintSkillsFor,
  officialStyleTag,
  type OfficialSatDomainId,
  type OfficialSatTestNumber,
} from "./officialSatBlueprint";
import { listSubs, paperById } from "./papers";
import { satPractice1 } from "./satPapers";
import type {
  ExamChoice,
  ExamResponseType,
  ExamSubQuestion,
  GeneratedSimilarQuestion,
  GeneratedSimilarSet,
  OfficialPaper,
} from "./types";

export type GenerateSimilarInput = {
  paperId: string;
  questionId?: string;
  count?: number;
  userId: string;
};

function clampCount(n: number | undefined) {
  if (n === undefined || Number.isNaN(n)) return 3;
  return Math.max(1, Math.min(6, Math.floor(n)));
}

function pickSub(paper: OfficialPaper, questionId?: string): ExamSubQuestion | undefined {
  const rows = listSubs(paper);
  if (questionId) {
    const hit = rows.find(
      (row) => row.sub.id === questionId || row.question.id === questionId || row.sub.label === questionId,
    );
    return hit?.sub;
  }
  return rows[0]?.sub;
}

function allSubs(paper: OfficialPaper): ExamSubQuestion[] {
  return listSubs(paper).map((row) => row.sub);
}

type VariantFactory = (seed: number, source: ExamSubQuestion) => GeneratedSimilarQuestion;

function mcq(
  id: string,
  prompt: string,
  latex: string | undefined,
  choices: ExamChoice[],
  correct: string,
  solution: string,
  skill: string,
  source: ExamSubQuestion,
  paperId: string,
): GeneratedSimilarQuestion {
  return {
    id,
    sourcePaperId: paperId,
    sourceQuestionId: source.id,
    skill,
    prompt,
    latex: latex ? formatLebaneseEquation(latex) : undefined,
    responseType: "mcq",
    choices,
    correctAnswer: correct,
    solution,
    marks: source.marks || 1,
  };
}

function spr(
  id: string,
  prompt: string,
  latex: string | undefined,
  correct: string,
  solution: string,
  skill: string,
  source: ExamSubQuestion,
  paperId: string,
  responseType: ExamResponseType = "spr",
): GeneratedSimilarQuestion {
  return {
    id,
    sourcePaperId: paperId,
    sourceQuestionId: source.id,
    skill,
    prompt,
    latex: latex ? formatLebaneseEquation(latex) : undefined,
    responseType,
    correctAnswer: correct,
    solution,
    marks: source.marks || 1,
  };
}

/** Deterministic SAT-style variants keyed by skill (same pattern, new numbers). */
const SKILL_VARIANTS: Record<string, VariantFactory> = {
  "linear-equation": (seed, source) => {
    const a = 2 + (seed % 5);
    const x = 3 + (seed % 7);
    const b = 4 + seed;
    const c = a * x + b;
    const distractors = [x - 2, x + 1, c, a + b].map(String);
    const choices: ExamChoice[] = [
      { id: "A", text: distractors[0]! },
      { id: "B", text: String(x) },
      { id: "C", text: distractors[1]! },
      { id: "D", text: distractors[2]! },
    ];
    return mcq(
      createId("gensim"),
      `If $${a}x + ${b} = ${c}$, what is the value of $x$?`,
      `${a}x+${b}=${c}`,
      choices,
      "B",
      `Subtract ${b}: $${a}x=${a * x}$. Divide by ${a}: $x=${x}$.`,
      "linear-equation",
      source,
      source.id.split("-")[0] ?? "sat",
    );
  },
  "linear-system": (seed, source) => {
    const x = 2 + (seed % 6);
    const y = 1 + (seed % 5);
    const s = x + y;
    const d = x - y;
    return spr(
      createId("gensim"),
      `The system $\\begin{cases} x+y=${s} \\\\ x-y=${d} \\end{cases}$ has solution $(x,y)$. What is $x$?`,
      `x+y=${s},\\quad x-y=${d}`,
      String(x),
      `Add: $2x=${s + d}\\Rightarrow x=${x}$.`,
      "linear-system",
      source,
      "sat",
    );
  },
  "linear-inequality": (seed, source) => {
    const a = 3 + (seed % 4);
    const bound = 4 + (seed % 5);
    const ok = bound - 1;
    const choices: ExamChoice[] = [
      { id: "A", text: String(ok) },
      { id: "B", text: String(bound + 1) },
      { id: "C", text: String(bound + 3) },
      { id: "D", text: String(bound + 5) },
    ];
    return mcq(
      createId("gensim"),
      `Which value of $n$ satisfies $${a}n \\le ${a * bound}$?`,
      `${a}n\\le ${a * bound}`,
      choices,
      "A",
      `Divide: $n\\le ${bound}$. Only ${ok} works among the choices.`,
      "linear-inequality",
      source,
      "sat",
    );
  },
  "quadratic-factor": (seed, source) => {
    const p = 2 + (seed % 4);
    const q = p + 1 + (seed % 3);
    const b = p + q;
    const c = p * q;
    const choices: ExamChoice[] = [
      { id: "A", text: `(x-${p - 1})(x-${q + 1})` },
      { id: "B", text: `(x-${p})(x-${q})` },
      { id: "C", text: `(x+${p})(x+${q})` },
      { id: "D", text: `(x-${p})(x+${q})` },
    ];
    return mcq(
      createId("gensim"),
      `Which is equivalent to $x^{2}-${b}x+${c}$?`,
      `x^{2}-${b}x+${c}`,
      choices,
      "B",
      `Roots ${p} and ${q}: $(x-${p})(x-${q})$.`,
      "quadratic-factor",
      source,
      "sat",
    );
  },
  "exponential-model": (seed, source) => {
    const base = 500 + seed * 50;
    return spr(
      createId("gensim"),
      `A quantity is modeled by $Q(t)=${base}\\cdot(1.04)^{t}$. What is $Q(0)$?`,
      `Q(t)=${base}(1.04)^{t}`,
      String(base),
      `$(1.04)^{0}=1$, so $Q(0)=${base}$.`,
      "exponential-model",
      source,
      "sat",
    );
  },
  "rational-simplify": (seed, source) => {
    const k = 2 + (seed % 4);
    const choices: ExamChoice[] = [
      { id: "A", text: "0" },
      { id: "B", text: "1" },
      { id: "C", text: String(k) },
      { id: "D", text: String(k * 2) },
    ];
    return mcq(
      createId("gensim"),
      `If $\\frac{${k}x+${k * 2}}{x+2}=m$ for $x\\neq -2$, what is $m$?`,
      `\\frac{${k}x+${2 * k}}{x+2}=m`,
      choices,
      "C",
      `$\\frac{${k}(x+2)}{x+2}=${k}$.`,
      "rational-simplify",
      source,
      "sat",
    );
  },
  percent: (seed, source) => {
    const pct = 10 + (seed % 5) * 5;
    const whole = 40 + seed * 10;
    const ans = (pct * whole) / 100;
    return spr(
      createId("gensim"),
      `What is ${pct}% of ${whole}?`,
      `\\frac{${pct}}{100}\\times ${whole}`,
      String(ans),
      `$\\frac{${pct}}{100}\\times ${whole}=${ans}$.`,
      "percent",
      source,
      "sat",
    );
  },
  pythagoras: (seed, source) => {
    const triples = [
      [3, 4, 5],
      [5, 12, 13],
      [6, 8, 10],
      [7, 24, 25],
      [9, 12, 15],
    ] as const;
    const [a, b, c] = triples[seed % triples.length]!;
    const choices: ExamChoice[] = [
      { id: "A", text: String(a + b) },
      { id: "B", text: String(c) },
      { id: "C", text: String(c + 2) },
      { id: "D", text: String(a * b) },
    ];
    return mcq(
      createId("gensim"),
      `A right triangle has legs ${a} and ${b}. What is the hypotenuse?`,
      `c=\\sqrt{${a}^{2}+${b}^{2}}`,
      choices,
      "B",
      `$\\sqrt{${a * a}+${b * b}}=\\sqrt{${c * c}}=${c}$.`,
      "pythagoras",
      source,
      "sat",
    );
  },
  "unit-rate": (seed, source) => {
    const hours = 2 + (seed % 4);
    const speed = 40 + seed * 5;
    const dist = hours * speed;
    return spr(
      createId("gensim"),
      `A car travels ${dist} miles in ${hours} hours at constant speed. Speed in mph?`,
      `v=\\frac{${dist}}{${hours}}`,
      String(speed),
      `$\\frac{${dist}}{${hours}}=${speed}$.`,
      "unit-rate",
      source,
      "sat",
    );
  },
  mean: (seed, source) => {
    const base = 60 + seed * 5;
    const vals = [base, base + 10, base + 20, base + 30];
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const choices: ExamChoice[] = [
      { id: "A", text: String(base) },
      { id: "B", text: String(avg - 5) },
      { id: "C", text: String(avg) },
      { id: "D", text: String(base + 30) },
    ];
    return mcq(
      createId("gensim"),
      `The scores ${vals.join(", ")} have mean`,
      `\\frac{${vals.join("+")}}{4}`,
      choices,
      "C",
      `Sum ${vals.reduce((s, v) => s + v, 0)}; divide by 4: ${avg}.`,
      "mean",
      source,
      "sat",
    );
  },
  "slope-meaning": (seed, source) => {
    const m = (1.5 + (seed % 4) * 0.5).toFixed(1);
    const choices: ExamChoice[] = [
      { id: "A", text: `Predicted y-intercept equals ${m}` },
      { id: "B", text: `Each extra unit of x raises predicted y by ${m}` },
      { id: "C", text: `Maximum y is ${m}` },
      { id: "D", text: `x must be a multiple of ${m}` },
    ];
    return mcq(
      createId("gensim"),
      `A line of best fit is $y=${m}x+8$. What does the slope ${m} mean?`,
      `y=${m}x+8`,
      choices,
      "B",
      `Slope = change in $y$ per unit $x$: +${m} per unit.`,
      "slope-meaning",
      source,
      "sat",
    );
  },
  "circle-area": (seed, source) => {
    const r = 3 + (seed % 5);
    const choices: ExamChoice[] = [
      { id: "A", text: `${2 * r}π` },
      { id: "B", text: `${r * r}π` },
      { id: "C", text: `${2 * r * r}π` },
      { id: "D", text: `${r * r * r}π` },
    ];
    return mcq(
      createId("gensim"),
      `A circle has radius ${r}. What is its area?`,
      `A=\\pi r^{2}`,
      choices,
      "B",
      `$A=\\pi\\cdot ${r}^{2}=${r * r}\\pi$.`,
      "circle-area",
      source,
      "sat",
    );
  },
  "similar-triangles": (seed, source) => {
    const small = 3 + (seed % 4);
    const large = small + 2;
    const bigSide = 10 + seed * 2;
    const ans = (bigSide * small) / large;
    return spr(
      createId("gensim"),
      `Similar triangles with side ratio $\\frac{${small}}{${large}}$. Larger side ${bigSide}; corresponding smaller side?`,
      `\\frac{${small}}{${large}}=\\frac{s}{${bigSide}}`,
      String(ans),
      `$s=${bigSide}\\cdot\\frac{${small}}{${large}}=${ans}$.`,
      "similar-triangles",
      source,
      "sat",
    );
  },
  "trig-ratio": (seed, source) => {
    const triples = [
      [3, 4, 5],
      [5, 12, 13],
      [8, 15, 17],
    ] as const;
    const [opp, adj, hyp] = triples[seed % triples.length]!;
    const choices: ExamChoice[] = [
      { id: "A", text: `${opp}/${hyp}` },
      { id: "B", text: `${opp}/${adj}` },
      { id: "C", text: `${adj}/${hyp}` },
      { id: "D", text: `${hyp}/${opp}` },
    ];
    return mcq(
      createId("gensim"),
      `In a right triangle, $\\sin\\theta=\\frac{${opp}}{${hyp}}$. What is $\\cos\\theta$ (acute $\\theta$)?`,
      `\\sin\\theta=\\frac{${opp}}{${hyp}}`,
      choices,
      "C",
      `Adjacent ${adj}, hypotenuse ${hyp}: $\\cos\\theta=\\frac{${adj}}{${hyp}}$.`,
      "trig-ratio",
      source,
      "sat",
    );
  },
  "function-eval": (seed, source) => {
    const a = 1 + (seed % 3);
    const b = 2 + (seed % 4);
    const c = seed % 5;
    const x = 2 + (seed % 3);
    const ans = a * x * x - b * x + c;
    return spr(
      createId("gensim"),
      `If $f(x)=${a}x^{2}-${b}x+${c}$, what is $f(${x})$?`,
      `f(x)=${a}x^{2}-${b}x+${c}`,
      String(ans),
      `$f(${x})=${a}\\cdot ${x * x}-${b}\\cdot ${x}+${c}=${ans}$.`,
      "function-eval",
      source,
      "sat",
    );
  },
  "absolute-value": (seed, source) => {
    const center = 2 + (seed % 6);
    const dist = 3 + (seed % 5);
    const choices: ExamChoice[] = [
      { id: "A", text: "0" },
      { id: "B", text: "2" },
      { id: "C", text: "1" },
      { id: "D", text: "4" },
    ];
    return mcq(
      createId("gensim"),
      `How many real solutions does $|x-${center}|=${dist}$ have?`,
      `|x-${center}|=${dist}`,
      choices,
      "B",
      `$x=${center + dist}$ or $x=${center - dist}$: two solutions.`,
      "absolute-value",
      source,
      "sat",
    );
  },
};

function genericVariant(seed: number, source: ExamSubQuestion, paperId: string): GeneratedSimilarQuestion {
  const n = 5 + seed;
  const choices: ExamChoice[] | undefined = source.choices
    ? [
        { id: "A", text: String(n - 1) },
        { id: "B", text: String(n) },
        { id: "C", text: String(n + 1) },
        { id: "D", text: String(n + 2) },
      ]
    : undefined;
  const responseType: ExamResponseType = source.responseType ?? (choices ? "mcq" : "spr");
  return {
    id: createId("gensim"),
    sourcePaperId: paperId,
    sourceQuestionId: source.id,
    skill: source.skill ?? "general",
    prompt: `Similar practice (variant ${seed + 1}): solve a related item in the same skill as “${source.prompt.replace(/\$\$/g, "$").slice(0, 80)}…” — find $x$ when $2x+${n}=${2 * n}$.`,
    latex: formatLebaneseEquation(`2x+${n}=${2 * n}`),
    responseType,
    choices,
    correctAnswer: choices ? "B" : String(n / 2),
    solution: `Subtract ${n}: $2x=${n}$. Divide by 2: $x=\\frac{${n}}{2}$.`,
    marks: source.marks || 1,
  };
}

function demoVariant(seed: number, source: ExamSubQuestion, paperId: string): GeneratedSimilarQuestion {
  const skill = source.skill ?? "general";
  const factory = SKILL_VARIANTS[skill];
  if (factory) {
    const q = factory(seed, source);
    return { ...q, sourcePaperId: paperId, sourceQuestionId: source.id };
  }
  return genericVariant(seed, source, paperId);
}

async function tryLlmVariants(
  paper: OfficialPaper,
  sources: ExamSubQuestion[],
  count: number,
): Promise<GeneratedSimilarQuestion[] | null> {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
  const openai = process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim() || "";
  if (!key && !openai) return null;

  const compact = sources.slice(0, Math.max(1, count)).map((sub) => ({
    id: sub.id,
    skill: sub.skill,
    prompt: sub.prompt,
    latex: sub.latex,
    responseType: sub.responseType ?? (sub.choices ? "mcq" : "spr"),
    choices: sub.choices,
    expected: sub.expected,
    solution: sub.solution,
  }));

  const instruction = `You are the MathMentor AI exam generator (brand: منذر حداره · MathMentor; an AI, never the human teacher) writing ORIGINAL SAT Math practice (not College Board copyright). Return JSON { "questions": [ { "skill", "prompt", "latex", "responseType": "mcq"|"spr", "choices": [{"id","text"}], "correctAnswer", "solution", "marks" } ] } with exactly ${count} NEW items in the same skill/pattern as the sources (different numbers/context). Use KaTeX fractions \\frac{a}{b}, no slash fractions. Never say Al-Tarah. Sources:\n${JSON.stringify(compact)}`;

  try {
    let text = "";
    if (key) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest")}:generateContent`, // gemini-2.5-flash is retired (404)
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
        },
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    } else if (openai) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openai}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
          messages: [
            { role: "system", content: "Return JSON only." },
            { role: "user", content: instruction },
          ],
          temperature: 0.4,
        }),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      text = payload.choices?.[0]?.message?.content ?? "";
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      questions?: Array<{
        skill?: string;
        prompt?: string;
        latex?: string;
        responseType?: ExamResponseType;
        choices?: ExamChoice[];
        correctAnswer?: string;
        solution?: string;
        marks?: number;
      }>;
    };
    const source = sources[0]!;
    const out: GeneratedSimilarQuestion[] = [];
    for (const row of parsed.questions ?? []) {
      if (!row.prompt || !row.correctAnswer || !row.solution) continue;
      out.push({
        id: createId("gensim"),
        sourcePaperId: paper.id,
        sourceQuestionId: source.id,
        skill: row.skill || source.skill || "general",
        prompt: row.prompt,
        latex: row.latex ? formatLebaneseEquation(row.latex) : undefined,
        responseType: row.responseType ?? (row.choices?.length ? "mcq" : "spr"),
        choices: row.choices,
        correctAnswer: row.correctAnswer,
        solution: row.solution,
        marks: typeof row.marks === "number" ? row.marks : source.marks || 1,
      });
    }
    return out.length ? out.slice(0, count) : null;
  } catch {
    return null;
  }
}

export async function generateSimilarQuestions(
  input: GenerateSimilarInput,
): Promise<{ set: GeneratedSimilarSet; paper: OfficialPaper }> {
  const paper = paperById(input.paperId);
  if (!paper) throw new Error(`Unknown paper ${input.paperId}`);
  const count = clampCount(input.count);
  const primary = pickSub(paper, input.questionId);
  if (!primary) throw new Error("No questions on this paper.");

  const sources = input.questionId ? [primary] : allSubs(paper).slice(0, count);
  const llm = await tryLlmVariants(paper, sources, count);
  let questions: GeneratedSimilarQuestion[];
  let source: "demo" | "llm" = "demo";
  if (llm && llm.length >= count) {
    questions = llm.slice(0, count);
    source = "llm";
  } else if (llm && llm.length > 0) {
    const filled = [...llm];
    let seed = 0;
    while (filled.length < count) {
      const src = sources[filled.length % sources.length]!;
      filled.push(demoVariant(seed, src, paper.id));
      seed += 1;
    }
    questions = filled.slice(0, count);
    source = "llm";
  } else {
    questions = [];
    for (let i = 0; i < count; i++) {
      const src = sources[i % sources.length]!;
      questions.push(demoVariant(i, src, paper.id));
    }
  }

  const set: GeneratedSimilarSet = {
    id: createId("genset"),
    paperId: paper.id,
    sourceQuestionId: input.questionId,
    userId: input.userId,
    source,
    questions,
    createdAt: new Date().toISOString(),
  };
  return { set, paper };
}


export type GenerateFromOfficialInput = {
  officialTest: OfficialSatTestNumber;
  skill?: string;
  count?: number;
  module?: 1 | 2;
  domain?: OfficialSatDomainId;
  skillNote?: string;
  userId: string;
};

/**
 * Generate ORIGINAL SAT-style items from the public Digital SAT Math blueprint
 * (keyed by College Board practice test number for pedagogy only).
 * Never copies College Board question text.
 */
export async function generateFromOfficial(
  input: GenerateFromOfficialInput,
): Promise<{ set: GeneratedSimilarSet; paper: OfficialPaper; tag: string }> {
  const officialTest = input.officialTest;
  if (officialTest !== 5 && officialTest !== 10 && officialTest !== 11) {
    throw new Error("officialTest must be 5, 10, or 11.");
  }
  const count = clampCount(input.count);
  const tag = officialStyleTag(officialTest);
  const paper = satPractice1; // platform scaffold only — skills/format, not CB items
  const skills = blueprintSkillsFor(officialTest, input.module, input.domain);
  const skillFilter = input.skill?.trim();
  const skillPool = skillFilter
    ? skills.includes(skillFilter)
      ? [skillFilter]
      : [skillFilter, ...skills]
    : skills;

  // Synthetic source stubs (skill + response type only — no CB prompts).
  const stubs: ExamSubQuestion[] = skillPool.map((skill, index) => {
    const factory = SKILL_VARIANTS[skill];
    const preferMcq = Boolean(factory) && index % 2 === 0;
    return {
      id: `${tag}-skill-${skill}`,
      label: String(index + 1),
      prompt: `Original Digital SAT–style practice · skill ${skill}`,
      promptAr: `تدريب أصلي على نسق Digital SAT · مهارة ${skill}`,
      marks: 1,
      expected: [],
      rubric: "1 point for correct answer.",
      responseType: preferMcq ? "mcq" : "spr",
      skill,
      solution: "",
    };
  });

  const llm = await tryLlmOfficialVariants({
    officialTest,
    stubs,
    count,
    skillNote: input.skillNote,
    module: input.module,
    tag,
  });

  let questions: GeneratedSimilarQuestion[];
  let source: "demo" | "llm" = "demo";
  if (llm && llm.length >= count) {
    questions = llm.slice(0, count);
    source = "llm";
  } else if (llm && llm.length > 0) {
    const filled = [...llm];
    let seed = officialTest * 17;
    while (filled.length < count) {
      const stub = stubs[filled.length % stubs.length]!;
      const q = demoVariant(seed + filled.length, stub, tag);
      filled.push({ ...q, tag, sourcePaperId: tag, sourceQuestionId: stub.id });
      seed += 1;
    }
    questions = filled.slice(0, count);
    source = "llm";
  } else {
    questions = [];
    for (let i = 0; i < count; i++) {
      const stub = stubs[i % stubs.length]!;
      const q = demoVariant(officialTest * 10 + i, stub, tag);
      questions.push({ ...q, tag, sourcePaperId: tag, sourceQuestionId: stub.id });
    }
  }

  const set: GeneratedSimilarSet = {
    id: createId("genset"),
    paperId: tag,
    userId: input.userId,
    source,
    questions,
    createdAt: new Date().toISOString(),
    tag,
    officialTest,
  };
  return { set, paper, tag };
}

async function tryLlmOfficialVariants(opts: {
  officialTest: OfficialSatTestNumber;
  stubs: ExamSubQuestion[];
  count: number;
  skillNote?: string;
  module?: 1 | 2;
  tag: string;
}): Promise<GeneratedSimilarQuestion[] | null> {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
  const openai = process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim() || "";
  if (!key && !openai) return null;

  const skillList = opts.stubs.map((s) => s.skill).filter(Boolean);
  const note = opts.skillNote?.trim() ? ` Teacher skill note: ${opts.skillNote.trim()}.` : "";
  const moduleHint = opts.module ? ` Target Module ${opts.module}.` : "";

  const instruction = `You are the MathMentor AI exam generator (brand: منذر حداره · MathMentor; an AI, never the human teacher) writing ORIGINAL Digital SAT Math practice (NOT College Board copyright). Follow the public blueprint: 2 modules × ~27 questions; domains Algebra, Advanced Math, Problem-Solving & Data, Geometry & Trig; MCQ A–D and SPR. Create exactly ${opts.count} NEW items in the style of Practice Test #${opts.officialTest} (pedagogy reference only — do NOT quote or paraphrase any real CB item).${moduleHint}${note} Prefer skills: ${JSON.stringify(skillList)}. Return JSON { "questions": [ { "skill", "prompt", "latex", "responseType": "mcq"|"spr", "choices": [{"id","text"}], "correctAnswer", "solution", "marks" } ] }. Use KaTeX \\frac{a}{b}, no slash fractions. Never say Al-Tarah. Never copy College Board wording.`;

  try {
    let text = "";
    if (key) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest")}:generateContent`, // gemini-2.5-flash is retired (404)
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
        },
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    } else if (openai) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openai}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
          messages: [
            { role: "system", content: "Return JSON only." },
            { role: "user", content: instruction },
          ],
          temperature: 0.45,
        }),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      text = payload.choices?.[0]?.message?.content ?? "";
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      questions?: Array<{
        skill?: string;
        prompt?: string;
        latex?: string;
        responseType?: ExamResponseType;
        choices?: ExamChoice[];
        correctAnswer?: string;
        solution?: string;
        marks?: number;
      }>;
    };
    const out: GeneratedSimilarQuestion[] = [];
    for (const row of parsed.questions ?? []) {
      if (!row.prompt || !row.correctAnswer || !row.solution) continue;
      const skill = row.skill || opts.stubs[0]?.skill || "general";
      out.push({
        id: createId("gensim"),
        sourcePaperId: opts.tag,
        sourceQuestionId: `${opts.tag}-skill-${skill}`,
        skill,
        prompt: row.prompt,
        latex: row.latex ? formatLebaneseEquation(row.latex) : undefined,
        responseType: row.responseType ?? (row.choices?.length ? "mcq" : "spr"),
        choices: row.choices,
        correctAnswer: row.correctAnswer,
        solution: row.solution,
        marks: typeof row.marks === "number" ? row.marks : 1,
        tag: opts.tag,
      });
    }
    return out.length ? out.slice(0, opts.count) : null;
  } catch {
    return null;
  }
}
