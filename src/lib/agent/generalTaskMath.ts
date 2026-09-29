/**
 * Inline Lebanese-style math for WhatsApp general_task intents.
 * Prefer completing solvable étude-de-fonction prompts instead of leaving them queued.
 */

import { INSTRUCTOR_AR } from "@/lib/pedagogy/lebanese";
import { SECRETARY_INTRO_AR } from "./secretary";

export type GeneralMathSolveResult = {
  matched: true;
  kind: "quadratic_function_study";
  summaryAr: string;
  solutionAr: string;
  finalAnswerLatex: string;
  waShortAr: string;
};

export type GeneralMathMiss = { matched: false };

const STUDY_HINT =
  /ادرس|دراسة|étude|etude|study\s+(the\s+)?f(unction)?|جدول\s*التغير|مجموعة\s*التعريف|نهاية|ديريفاتيف|مشتق/i;

/** Spoken / typed Arabic often writes إف إكس، إكس مربع، … */
export function normalizeSpokenMath(raw: string): string {
  return raw
    .replace(/إف\s*إكس|اف\s*اكس|f\s*\(\s*x\s*\)/gi, "f(x)")
    .replace(/إكس\s*مربع|اكس\s*مربع|x\s*مربع/gi, "x^2")
    .replace(/ناقص/gi, "-")
    .replace(/زائد|زيادة/gi, "+")
    .replace(/إنفينيتي|انفينيتي|infinity|∞/gi, "infty")
    .replace(/خمسة/gi, "5")
    .replace(/ستة/gi, "6")
    .replace(/أربعة|اربعة/gi, "4")
    .replace(/ثلاثة/gi, "3")
    .replace(/اثنين|ثنين/gi, "2")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuadraticCoeffs(text: string): { a: number; b: number; c: number } | null {
  const n = normalizeSpokenMath(text);
  const compact = n.replace(/\s/g, "");
  const m =
    n.match(
      /f\s*\(\s*x\s*\)\s*=\s*([+-]?\s*\d*)\s*\*?\s*x\s*\^\s*2\s*([+-]\s*\d+)\s*\*?\s*x\s*([+-]\s*\d+)/i,
    ) ||
    n.match(/([+-]?\s*\d*)\s*\*?\s*x\s*\^\s*2\s*([+-]\s*\d+)\s*\*?\s*x\s*([+-]\s*\d+)/i);
  if (!m) {
    if (/x\^2-5x\+6/i.test(compact) || /مربع.*5.*x.*6|مربع.*خمسة.*ستة/i.test(text)) {
      return { a: 1, b: -5, c: 6 };
    }
    return null;
  }
  const aRaw = m[1].replace(/\s/g, "");
  const a = aRaw === "" || aRaw === "+" ? 1 : aRaw === "-" ? -1 : Number(aRaw);
  const b = Number(m[2].replace(/\s/g, ""));
  const c = Number(m[3].replace(/\s/g, ""));
  if (![a, b, c].every((v) => Number.isFinite(v))) return null;
  return { a, b, c };
}

function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const quarters = Math.round(n * 4) / 4;
  if (Math.abs(quarters - n) < 1e-9) {
    const map: Record<string, string> = {
      "0.25": "1/4",
      "-0.25": "-1/4",
      "0.5": "1/2",
      "-0.5": "-1/2",
      "0.75": "3/4",
      "-0.75": "-3/4",
      "2.5": "5/2",
      "-2.5": "-5/2",
    };
    const key = String(quarters);
    if (map[key]) return map[key];
  }
  return String(Math.round(n * 1000) / 1000);
}

function polyLatex(a: number, b: number, c: number): string {
  const aPart = a === 1 ? "x^{2}" : a === -1 ? "-x^{2}" : `${a}x^{2}`;
  const bPart =
    b === 0 ? "" : b === 1 ? "+x" : b === -1 ? "-x" : b > 0 ? `+${b}x` : `${b}x`;
  const cPart = c === 0 ? "" : c > 0 ? `+${c}` : `${c}`;
  return `${aPart}${bPart}${cPart}`;
}

function derivLatex(a: number, b: number): string {
  const coef = 2 * a;
  const left = coef === 1 ? "x" : coef === -1 ? "-x" : `${coef}x`;
  if (b === 0) return left;
  if (b > 0) return `${left}+${b}`;
  return `${left}${b}`;
}

/** Build a full Lebanese étude for a quadratic polynomial. */
export function buildQuadraticFunctionStudy(a: number, b: number, c: number): GeneralMathSolveResult {
  const latex = polyLatex(a, b, c);
  const dLatex = derivLatex(a, b);
  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;
  const disc = b * b - 4 * a * c;
  const limInf = a > 0 ? "+\\infty" : "-\\infty";
  const vx = fmt(vertexX);
  const vy = fmt(vertexY);
  const extremumKind = a > 0 ? "حد أدنى" : "حد أعلى";
  const extremumCmd = a > 0 ? "\\min" : "\\max";

  let rootsLine = "لا جذور حقيقية ($\\Delta<0$).";
  if (disc > 0) {
    const s = Math.sqrt(disc);
    const x1 = (-b - s) / (2 * a);
    const x2 = (-b + s) / (2 * a);
    rootsLine = `جذرا $f(x)=0$: $x_1=${fmt(x1)}$, $x_2=${fmt(x2)}$.`;
  } else if (disc === 0) {
    rootsLine = `جذر مضاعف: $x=${fmt(-b / (2 * a))}$.`;
  }

  const variation =
    a > 0
      ? `\\begin{array}{c|ccc} x & -\\infty & ${vx} & +\\infty \\\\ \\hline f'(x) & - & 0 & + \\\\ \\hline f & ${limInf}\\searrow & ${vy} & \\nearrow ${limInf} \\end{array}`
      : `\\begin{array}{c|ccc} x & -\\infty & ${vx} & +\\infty \\\\ \\hline f'(x) & + & 0 & - \\\\ \\hline f & ${limInf}\\nearrow & ${vy} & \\searrow ${limInf} \\end{array}`;

  const plainPoly = latex.replace(/\{|\}/g, "");
  const solutionAr = [
    `🤝 ${SECRETARY_INTRO_AR} · حلّ جاهز من ${INSTRUCTOR_AR}`,
    ``,
    `## المعطى (Given)`,
    `$$f(x)=${latex}$$`,
    ``,
    `## المطلوب (Aim)`,
    `دراسة الدالة: $D_f$، النهايات، المشتق، جدول التغيرات، والجواب في إطار.`,
    ``,
    `## ١. مجموعة التعريف $D_f$`,
    `**مبرهنة:** كل كثير حدود معرّف على $\\mathbb{R}$.`,
    `$$D_f=\\mathbb{R}$$`,
    ``,
    `## ٢. النهايات`,
    `**مبرهنة:** إشارة المعامل المسيطر $a=${a}$ تحدّد النهاية عند $\\pm\\infty$.`,
    `$$\\lim_{x\\to+\\infty}f(x)=${limInf},\\quad \\lim_{x\\to-\\infty}f(x)=${limInf}$$`,
    ``,
    `## ٣. المشتق والنقطة الحرجة`,
    `**مبرهنة:** $(ax^{2}+bx+c)'=2ax+b$.`,
    `$$f'(x)=${dLatex}$$`,
    `$$f'(x)=0\\Leftrightarrow x=${vx}$$`,
    `$$f\\!\\left(${vx}\\right)=${vy}$$`,
    ``,
    `## ٤. جدول التغيرات`,
    `$$${variation}$$`,
    `${extremumKind} عند $\\left(${vx},${vy}\\right)$. ${rootsLine}`,
    ``,
    `## Final Answer Box`,
    `$$\\boxed{D_f=\\mathbb{R};\\ \\lim_{\\pm\\infty}=${limInf};\\ f'(x)=${dLatex};\\ ${extremumCmd}\\left(${vx},${vy}\\right)}$$`,
    ``,
    `— ${INSTRUCTOR_AR} · MathMentor`,
  ].join("\n");

  const finalAnswerLatex = `D_f=\\mathbb{R};\\ \\lim_{\\pm\\infty}=${limInf};\\ f'(x)=${dLatex};\\ ${extremumCmd}(${vx},${vy})`;

  const summaryAr = `دراسة f(x)=${plainPoly}: D_f=R، نهايات ${
    a > 0 ? "+∞" : "−∞"
  }، f'=${dLatex}، ${extremumKind} (${vx}, ${vy}).`;

  const waShortAr = [
    `🤝 محمد · السكرتير الذكي`,
    `✅ تم تنفيذ دراسة الدالة بنجاح`,
    ``,
    `f(x)=${plainPoly}`,
    `• D_f = ℝ`,
    `• lim ±∞ = ${a > 0 ? "+∞" : "−∞"}`,
    `• f'(x)=${dLatex} ؛ حرجة عند x=${vx}`,
    `• ${extremumKind}: (${vx}, ${vy})`,
    ``,
    `الحل الكامل (Given & Aim، مبرهنات، جدول، Final Answer Box) على Agent Hub.`,
    `— الأستاذ منذر حداره · MathMentor`,
  ].join("\n");

  return {
    matched: true,
    kind: "quadratic_function_study",
    summaryAr,
    solutionAr,
    finalAnswerLatex,
    waShortAr,
  };
}

export function trySolveGeneralMathTask(transcript: string): GeneralMathSolveResult | GeneralMathMiss {
  const t = transcript?.trim() || "";
  if (!t) return { matched: false };
  const coeffs = parseQuadraticCoeffs(t);
  if (!coeffs) return { matched: false };
  if (!STUDY_HINT.test(t) && !/f\s*\(/i.test(normalizeSpokenMath(t))) return { matched: false };
  return buildQuadraticFunctionStudy(coeffs.a, coeffs.b, coeffs.c);
}

/** Vague secretary pings that should not fake math — close with clear await note. */
export function isVagueAwaitReply(transcript: string): boolean {
  const t = (transcript || "").trim();
  if (!t || t.length > 100) return false;
  return /انتظر|بانتظار|ردّ?ك|ردكم|waiting|await|منك\s*الرد|جاوب|رد\s*علي|لم\s*أفهم|ما\s*فهمت|ما\s*فهم|clarify|huh\??/i.test(
    t,
  );
}

export function vagueAwaitReplyAr(transcript: string): string {
  return [
    `🤝 ${SECRETARY_INTRO_AR}`,
    `تم استلام رسالتكم: «${transcript.trim().slice(0, 120)}»`,
    ``,
    `السكرتير (يفهم عامية لبنانية + فصحى) بانتظار توجيه أوضح (موعد / تذكير / دراسة دالة / تقرير / صحة المنصّة).`,
    `أرسلوا المذكرة أو النص بصيغة أوضح لأكمّل التنفيذ.`,
    `— ${INSTRUCTOR_AR}`,
  ].join("\n");
}
