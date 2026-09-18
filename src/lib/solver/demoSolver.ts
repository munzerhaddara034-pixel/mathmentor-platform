import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";
import { assembleSolution, type GraphSpec, type TrapSpec } from "./assemble";
import { isGarbledPrompt, retakeSolution } from "./retake";
import type { MathSolution, SolverStep } from "./types";

export type SolveRequest = {
  question: string;
  latex?: string;
  language?: LessonLanguage;
  track?: CertificateTrack;
  imageName?: string;
};

export const SAMPLE_QUESTIONS = [
  { id: "quad", label: "x² − 5x + 6 = 0", question: "Solve x^2 - 5x + 6 = 0", track: "brevet" as const },
  { id: "lim", label: "lim (3x²+1)/(x²−2)", question: "Compute lim x->inf (3x^2 + 1)/(x^2 - 2)", track: "ls" as const },
  { id: "exp", label: "f(x)=(x−1)e^x", question: "Let f(x)=(x-1)e^x. Find f'(x) and the minimum.", track: "ls" as const },
  { id: "sys", label: "2x+y=8, x−y=1", question: "Solve the system 2x + y = 8 and x - y = 1", track: "brevet" as const },
  { id: "pyth", label: "Triangle 3-4-5", question: "A right triangle has legs 3 and 4. Find the hypotenuse.", track: "brevet" as const },
  { id: "sat", label: "SAT: 2x+3=11", question: "If 2x + 3 = 11, what is the value of x?", track: "sat" as const },
];

function normalize(text: string) {
  return text
    .replace(/[−–—]/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/√/g, "sqrt")
    .replace(/∞/g, "inf")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, " ")
    .trim();
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return String(n);
  const rounded = Math.round(n * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

function polyLatex(a: number, b: number, c: number) {
  const term2 = a === 1 ? "x^{2}" : a === -1 ? "-x^{2}" : `${fmt(a)}x^{2}`;
  const term1 = b === 0 ? "" : b === 1 ? "+x" : b === -1 ? "-x" : `${b > 0 ? "+" : ""}${fmt(b)}x`;
  const term0 = c === 0 ? "" : `${c > 0 ? "+" : ""}${fmt(c)}`;
  return `${term2}${term1}${term0}=0`;
}

function parseSignedTerms(poly: string) {
  const cleaned = poly.replace(/\s+/g, "").replace(/^\+/, "");
  const parts = cleaned.split(/(?=[+-])/).filter(Boolean);
  let a = 0;
  let b = 0;
  let c = 0;
  for (const part of parts) {
    if (/x\^2|x²/i.test(part)) {
      const coef = part.replace(/x\^2|x²/gi, "");
      if (coef === "" || coef === "+") a += 1;
      else if (coef === "-") a -= 1;
      else a += Number(coef);
    } else if (/x/i.test(part) && !/x\^/.test(part)) {
      const coef = part.replace(/x/gi, "");
      if (coef === "" || coef === "+") b += 1;
      else if (coef === "-") b -= 1;
      else b += Number(coef);
    } else {
      c += Number(part);
    }
  }
  if (![a, b, c].every((n) => Number.isFinite(n))) return null;
  return { a, b, c };
}

function parseQuadratic(text: string) {
  const n = normalize(text)
    .replace(/solve|find|compute|let|if|what is|the value of|équation|حل|أوجد/gi, "")
    .replace(/=\s*0$/, "")
    .trim();
  const candidate = n.match(/[+-]?\s*\d*\.?\d*\s*\*?\s*x\^2[^.]*/i)?.[0] ?? n;
  const left = candidate.includes("=") ? candidate.split("=")[0] : candidate;
  const right = candidate.includes("=") ? candidate.split("=").slice(1).join("=") : "0";
  const leftPoly = parseSignedTerms(left.replace(/[^0-9x^+.\-]/gi, (ch) => (ch === " " ? "" : "")));
  if (!leftPoly || leftPoly.a === 0) {
    const compact = left.replace(/\s+/g, "");
    const retry = parseSignedTerms(compact);
    if (!retry || retry.a === 0) return null;
    const rightNum = Number(String(right).replace(/\s/g, ""));
    if (Number.isFinite(rightNum) && right !== "0") retry.c -= rightNum;
    return retry;
  }
  const rightNum = Number(String(right).replace(/\s/g, ""));
  if (Number.isFinite(rightNum) && right !== "0") leftPoly.c -= rightNum;
  return leftPoly;
}

function parseLinear(text: string) {
  const n = normalize(text).replace(/solve|find|if|what is|the value of|حل/gi, "");
  const match = n.match(/([+-]?\s*\d*\.?\d*)\s*\*?\s*x\s*([+-]\s*\d+\.?\d*)?\s*=\s*([+-]?\s*\d+\.?\d*)/i);
  if (!match) return null;
  const aRaw = match[1].replace(/\s/g, "");
  const a = aRaw === "" || aRaw === "+" ? 1 : aRaw === "-" ? -1 : Number(aRaw);
  const b = match[2] ? Number(match[2].replace(/\s/g, "")) : 0;
  const c = Number(match[3].replace(/\s/g, ""));
  if (![a, b, c].every((v) => Number.isFinite(v)) || a === 0) return null;
  return { a, b, c };
}

function parseSystem(text: string) {
  const n = normalize(text);
  const eqs = n.split(/and|,|;|\n|و/).map((s) => s.trim()).filter((s) => /x/.test(s) && /y/.test(s) && /=/.test(s));
  if (eqs.length < 2) {
    const all = [...n.matchAll(/([+-]?\d*)\s*x\s*([+-]\d*)\s*y\s*=\s*([+-]?\d+)/gi)];
    if (all.length < 2) return null;
    const rows = all.slice(0, 2).map((m) => ({
      a: m[1] === "" || m[1] === "+" ? 1 : m[1] === "-" ? -1 : Number(m[1]),
      b: m[2] === "" || m[2] === "+" ? 1 : m[2] === "-" ? -1 : Number(m[2]),
      c: Number(m[3]),
    }));
    return { r1: rows[0], r2: rows[1] };
  }
  const parseEq = (eq: string) => {
    const compact = eq.replace(/\s+/g, "");
    const m = compact.match(/([+-]?\d*)x([+-]\d*)y=([+-]?\d+)/i);
    if (!m) return null;
    return {
      a: m[1] === "" || m[1] === "+" ? 1 : m[1] === "-" ? -1 : Number(m[1]),
      b: m[2] === "" || m[2] === "+" ? 1 : m[2] === "-" ? -1 : Number(m[2]),
      c: Number(m[3]),
    };
  };
  const r1 = parseEq(eqs[0]);
  const r2 = parseEq(eqs[1]);
  if (!r1 || !r2) return null;
  return { r1, r2 };
}

function quadraticSolution(a: number, b: number, c: number, language: LessonLanguage, track: CertificateTrack): MathSolution {
  const d = b * b - 4 * a * c;
  const twoA = 2 * a;
  let rootsLatex: string;
  let finalAnswer: string;
  const steps: SolverStep[] = [
    {
      title: "Write the canonical form",
      titleFr: "Forme canonique",
      titleAr: "الشكل العام",
      examVerbEn: "Show that",
      examVerbFr: "Montrer que",
      latex: polyLatex(a, b, c),
      theoremEn: "Canonical form ax^{2}+bx+c=0 with a ≠ 0",
      theoremAr: "الشكل العام ax^{2}+bx+c=0 بشرط a ≠ 0",
      explanationEn: "A Lebanese Brevet / Terminale quadratic is written ax^2+bx+c=0 with a ≠ 0 before any formula.",
      explanationFr: "On écrit ax^2+bx+c=0 avec a ≠ 0 avant toute formule, comme sur une copie Brevet / Terminale.",
      explanationAr: "نكتب المعادلة من الدرجة الثانية بالشكل العام قبل أي قانون.",
    },
    {
      title: "Discriminant",
      titleFr: "Discriminant",
      titleAr: "المميّز",
      examVerbEn: "Calculate",
      examVerbFr: "Calculer",
      latex: `\\Delta=b^{2}-4ac=${fmt(b)}^{2}-4(${fmt(a)})(${fmt(c)})=${fmt(d)}`,
      theoremEn: "Discriminant Δ = b^{2} − 4ac",
      theoremAr: "المميّز Δ = b^{2} − 4ac",
      explanationEn: "Δ = b² − 4ac. The sign of Δ decides two real roots, a double root, or no real root.",
      explanationFr: "Δ = b² − 4ac. Le signe de Δ décide deux racines réelles, une racine double, ou aucune racine réelle.",
      explanationAr: "المميّز Δ=b²−4ac يحدد عدد الجذور الحقيقية.",
    },
  ];

  let graph: GraphSpec = {
    fn: `${a}*x*x + (${b})*x + (${c})`,
    domain: [-6, 8],
    highlights: {},
  };

  if (d < 0) {
    rootsLatex = "\\text{no real roots}";
    finalAnswer = "No real solutions (Δ < 0)";
    steps.push({
      title: "Conclusion",
      titleFr: "Conclusion",
      titleAr: "الخلاصة",
      latex: "\\Delta<0\\Rightarrow \\text{no real roots}",
      explanationEn: "Δ is negative, so the parabola does not cross the x-axis. Box: no real solution.",
      explanationFr: "Δ est négatif : la parabole ne coupe pas l’axe des abscisses. Aucune solution réelle.",
      explanationAr: "Δ سالب فلا يوجد جذر حقيقي.",
    });
  } else if (d === 0) {
    const x = -b / twoA;
    rootsLatex = `x=${fmt(x)}`;
    finalAnswer = `x = ${fmt(x)} (double root)`;
    graph.highlights = { roots: [[x, 0]], extrema: [[x, a * x * x + b * x + c]] };
    steps.push({
      title: "Double root",
      titleFr: "Racine double",
      titleAr: "جذر مضاعف",
      latex: `x=\\dfrac{-b}{2a}=\\dfrac{${fmt(-b)}}{${fmt(twoA)}}=${fmt(x)}`,
      explanationEn: "Δ = 0 gives one real root of multiplicity two. Substitute back: the quadratic is a perfect square.",
      explanationFr: "Δ = 0 donne une racine réelle double. La substitution confirme un carré parfait.",
      explanationAr: "Δ=0 يعطي جذراً حقيقياً مضاعفاً.",
    });
  } else {
    const sqrtD = Math.sqrt(d);
    const exactSquare = Number.isInteger(Math.round(sqrtD * 1e6) / 1e6) && Number.isInteger(sqrtD);
    const x1 = (-b + sqrtD) / twoA;
    const x2 = (-b - sqrtD) / twoA;
    rootsLatex = exactSquare
      ? `x_1=${fmt(x1)},\\ x_2=${fmt(x2)}`
      : `x=\\dfrac{-b\\pm\\sqrt{\\Delta}}{2a}=\\dfrac{${fmt(-b)}\\pm\\sqrt{${fmt(d)}}}{${fmt(twoA)}}`;
    finalAnswer = `x = ${fmt(x1)} or x = ${fmt(x2)}`;
    graph.highlights = { roots: [[x1, 0], [x2, 0]] };
    steps.push({
      title: "Quadratic formula",
      titleFr: "Formule quadratique",
      titleAr: "القانون العام",
      latex: rootsLatex,
      theoremEn: "x = (-b ± √Δ) / (2a) when Δ > 0",
      theoremAr: "x = (-b ± √Δ) / (2a) عندما Δ > 0",
      explanationEn: "Two real roots. If Δ is a perfect square, factor over the integers as a Brevet paper expects.",
      explanationFr: "Deux racines réelles. Si Δ est un carré parfait, on factorise sur les entiers comme au Brevet.",
      explanationAr: "جذران حقيقيان. إذا كان Δ مربعاً كاملاً نفكك على الأعداد الصحيحة.",
    });
    if (exactSquare) {
      steps.push({
        title: "Factor and check",
        titleFr: "Factoriser et vérifier",
        titleAr: "التفكيك والتحقق",
        latex: `a(x-x_1)(x-x_2)=0`,
        explanationEn: `Check: substitute each root. Both satisfy the original equation, so we box ${finalAnswer}.`,
        explanationFr: `Vérification par substitution. Les deux racines conviennent : on encadre ${finalAnswer}.`,
        explanationAr: `نتحقق بالتعويض ثم نضع الناتج في إطار.`,
      });
    }
  }

  const trap: TrapSpec = {
    wrong: "Using x = −b/2a for every quadratic, or forgetting that a ≠ 0.",
    wrongFr: "Utiliser x = −b/2a pour toute quadratique, ou oublier a ≠ 0.",
    correction: "The vertex formula is only the axis of symmetry. Roots come from Δ, then ±√Δ.",
    correctionFr: "−b/2a est l’axe de symétrie. Les racines viennent de Δ, puis ±√Δ.",
    latex: rootsLatex,
  };

  return assembleSolution({
    question: polyLatex(a, b, c).replace(/\{|\}/g, ""),
    summary: `Quadratic equation over the real numbers. Discriminant Δ=${fmt(d)}.`,
    finalAnswer,
    finalAnswerLatex: rootsLatex,
    steps,
    graph,
    trap,
    examTip: {
      en: "Key Idea / Exam Tip: do not jump to the formula. Write ax²+bx+c=0 with a ≠ 0, calculate Δ, then the roots. x=−b/(2a) is the axis of symmetry, not a root unless Δ=0.",
      fr: "Idée clé : ne pas sauter à la formule. Écrire ax²+bx+c=0 avec a ≠ 0, calculer Δ, puis les racines. x=−b/(2a) est l’axe de symétrie, pas une racine sauf si Δ=0.",
      ar: "الفكرة: اكتب الشكل العام ثم احسب Δ ثم الجذور. رأس القطع ليس جذراً إلا إذا Δ=0.",
    },
    studyKind: "algebra",
    topic: "Quadratic equations",
    topicTag: "quadratic",
    given: {
      latex: polyLatex(a, b, c),
      aimEn: "Solve over \\mathbb{R} and box the roots.",
      aimFr: "Résoudre sur R et encadrer les racines.",
      aimAr: "حلّ المعادلة على R ووضع الجذور في إطار.",
    },
    track,
    language,
    source: "demo",
  });
}

function linearSolution(a: number, b: number, c: number, language: LessonLanguage, track: CertificateTrack): MathSolution {
  const x = (c - b) / a;
  const steps: SolverStep[] = [
    {
      title: "Isolate the unknown",
      titleFr: "Isoler l’inconnue",
      titleAr: "عزل المجهول",
      latex: `${fmt(a)}x=${fmt(c - b)}`,
      explanationEn: "Keep the balance: subtract the constant from both sides before dividing.",
      explanationFr: "On conserve l’équilibre : retrancher la constante des deux côtés avant de diviser.",
      explanationAr: "نحافظ على التوازن: نطرح الثابت من الطرفين ثم نقسم.",
    },
    {
      title: "Divide by the coefficient",
      titleFr: "Diviser par le coefficient",
      titleAr: "القسمة على المعامل",
      latex: `x=\\dfrac{${fmt(c - b)}}{${fmt(a)}}=${fmt(x)}`,
      explanationEn: "Division by a ≠ 0. SAT and Brevet both require the inverse operation written, not mental arithmetic only.",
      explanationFr: "Division par a ≠ 0. On écrit l’opération inverse, pas un calcul mental seul.",
      explanationAr: "نقسم على المعامل بشرط أنه لا يساوي صفراً.",
    },
    {
      title: "Substitute back",
      titleFr: "Substituer",
      titleAr: "التعويض",
      latex: `${fmt(a)}(${fmt(x)})+${fmt(b)}=${fmt(c)}`,
      explanationEn: "Independent check: left side equals right side, so the boxed value is accepted.",
      explanationFr: "Contrôle : le membre gauche égale le membre droit.",
      explanationAr: "نتحقق بالتعويض في المعادلة الأصلية.",
    },
  ];
  return assembleSolution({
    question: `${fmt(a)}x + ${fmt(b)} = ${fmt(c)}`,
    summary: "Linear equation in one unknown.",
    finalAnswer: `x = ${fmt(x)}`,
    finalAnswerLatex: `x=${fmt(x)}`,
    steps,
    graph: { fn: `${a}*x + (${b})`, domain: [x - 4, x + 4], highlights: { roots: [[( -b) / a, 0]] } },
    trap: {
      wrong: "Moving a term across the equals sign and changing its sign twice, or dividing only one side.",
      wrongFr: "Changer le signe deux fois, ou diviser un seul membre.",
      correction: "Every operation is applied to both sides. Then substitute.",
      correctionFr: "Chaque opération s’applique aux deux membres. Puis on substitue.",
      latex: `x=${fmt(x)}`,
    },
    topic: "Linear equations",
    topicTag: "linear",
    given: {
      latex: `${fmt(a)}x+${fmt(b)}=${fmt(c)}`,
      aimEn: "Solve for x and substitute back.",
      aimAr: "إيجاد x ثم التعويض للتحقق.",
    },
    track,
    language,
    source: "demo",
  });
}

function systemSolution(
  r1: { a: number; b: number; c: number },
  r2: { a: number; b: number; c: number },
  language: LessonLanguage,
  track: CertificateTrack,
): MathSolution {
  const det = r1.a * r2.b - r2.a * r1.b;
  if (det === 0) {
    return assembleSolution({
      question: `${r1.a}x+${r1.b}y=${r1.c}; ${r2.a}x+${r2.b}y=${r2.c}`,
      summary: "Linear system 2×2. Determinant is zero.",
      finalAnswer: "No unique solution (parallel or coincident lines)",
      finalAnswerLatex: "\\det=0",
      steps: [
        { title: "Determinant", titleFr: "Déterminant", latex: "\\Delta=0", explanationEn: "The coefficient matrix is singular.", explanationFr: "La matrice des coefficients est singulière." },
        { title: "Geometry", titleFr: "Géométrie", latex: "\\text{parallel or coincident}", explanationEn: "Either no solution or infinitely many.", explanationFr: "Soit aucune solution, soit une infinité." },
        { title: "Conclusion", titleFr: "Conclusion", latex: "\\text{no unique pair }(x,y)", explanationEn: "A Brevet system that is not Cramer-ready is reported as such.", explanationFr: "On le signale comme un système non de Cramer." },
      ],
      topic: "Linear systems",
      track,
      language,
      source: "demo",
    });
  }
  const x = (r1.c * r2.b - r2.c * r1.b) / det;
  const y = (r1.a * r2.c - r2.a * r1.c) / det;
  const g = gcd(Math.round(det), gcd(Math.round(r1.c * r2.b - r2.c * r1.b), Math.round(r1.a * r2.c - r2.a * r1.c)));
  void g;
  const steps: SolverStep[] = [
    {
      title: "Write the 2×2 system",
      titleFr: "Écrire le système",
      titleAr: "كتابة الجملة",
      latex: `\\begin{cases}${fmt(r1.a)}x+${fmt(r1.b)}y=${fmt(r1.c)}\\\\${fmt(r2.a)}x+${fmt(r2.b)}y=${fmt(r2.c)}\\end{cases}`,
      explanationEn: "Brevet systems are solved by elimination or substitution after aligning like terms.",
      explanationFr: "Au Brevet on aligne les termes semblables, puis élimination ou substitution.",
      explanationAr: "نرتب الحدود ثم نستخدم الحذف أو التعويض.",
    },
    {
      title: "Cramer / elimination",
      titleFr: "Cramer / élimination",
      titleAr: "كرamer / الحذف",
      latex: `\\Delta=${fmt(r1.a)}\\cdot${fmt(r2.b)}-${fmt(r2.a)}\\cdot${fmt(r1.b)}=${fmt(det)}`,
      explanationEn: `The determinant is ${fmt(det)} ≠ 0, so there is a unique pair.`,
      explanationFr: `Le déterminant vaut ${fmt(det)} ≠ 0 : couple unique.`,
      explanationAr: `المحدّد ${fmt(det)} لا يساوي صفراً فالحل وحيد.`,
    },
    {
      title: "Solve for x and y",
      titleFr: "Trouver x et y",
      titleAr: "إيجاد x و y",
      latex: `x=${fmt(x)},\\quad y=${fmt(y)}`,
      explanationEn: "Substitute one equation into the other, or use Cramer’s rule. Then check both originals.",
      explanationFr: "Substitution ou Cramer, puis contrôle dans les deux équations.",
      explanationAr: "بالتعويض أو المحددات ثم التحقق في المعادلتين.",
    },
  ];
  return assembleSolution({
    question: `${r1.a}x+${r1.b}y=${r1.c} and ${r2.a}x+${r2.b}y=${r2.c}`,
    summary: "2×2 linear system (Brevet).",
    finalAnswer: `x = ${fmt(x)}, y = ${fmt(y)}`,
    finalAnswerLatex: `x=${fmt(x)},\\ y=${fmt(y)}`,
    steps,
    graph: { fn: `(${r1.c} - (${r1.a})*x)/${r1.b || 1}`, domain: [x - 4, x + 4], highlights: { roots: [[x, y]] } },
    trap: {
      wrong: "Adding the equations after making the x-coefficients equal without multiplying the constant terms.",
      wrongFr: "Additionner après avoir égalé les x sans multiplier aussi les constantes.",
      correction: "Every row operation multiplies the whole equation, including the right-hand side.",
      correctionFr: "Toute opération de ligne multiplie toute l’équation, second membre compris.",
      latex: `x=${fmt(x)},\\ y=${fmt(y)}`,
    },
      topic: "Systems of linear equations",
      topicTag: "systems",
    track,
    language,
    source: "demo",
  });
}

function exponentialSolution(language: LessonLanguage, track: CertificateTrack): MathSolution {
  const variation =
    "\\begin{array}{c|ccc} x & -\\infty & 0 & +\\infty \\\\ \\hline f'(x) & - & 0 & + \\\\ \\hline f & 0\\searrow & -1 & \\nearrow +\\infty \\end{array}";
  return assembleSolution({
    question: "Let f(x)=(x-1)e^x. Study f: domain, limits, derivative, table of variations, and the minimum.",
    summary: "Terminale LS/GS/SE study of f(x)=(x-1)e^x — official exam sequence D_f → limits/asymptotes → f'/variation → points/graph.",
    finalAnswer: "D_f=R, y=0, f'(x)=x e^x, min(0,-1)",
    finalAnswerLatex: "D_f=\\mathbb{R},\\ y=0,\\ f'(x)=x e^{x},\\ \\min(0,-1)",
    examTip: {
      en: "Key Idea / Exam Tip: this is a complete étude de fonction, not a slogan. Write D_f first, then both limits with the asymptote equation y=0, then the product rule and the table of variations, then C_f. Never write (−∞)×0 = 0.",
      fr: "Idée clé / Conseil d’épreuve : c’est une étude complète, pas un slogan. Écrire D_f d’abord, puis les deux limites avec y=0, puis la règle du produit et le tableau de variation, puis C_f. Ne jamais écrire (−∞)×0 = 0.",
      ar: "الفكرة: دراسة كاملة لا شعار. مجموعة التعريف أولاً ثم النهايات والمستقيم المقارب y=0 ثم المشتق وجدول التغيرات ثم الرسم.",
    },
    studyKind: "real_function",
    asymptotes: [{ kind: "horizontal", equation: "y=0" }],
    steps: [
      {
        title: "Domain of definition D_f",
        titleFr: "Ensemble de définition D_f",
        titleAr: "مجموعة التعريف D_f",
        examVerbEn: "Show that",
        examVerbFr: "Montrer que",
        latex: "D_f=\\mathbb{R}",
        theoremEn: "A polynomial and e^x are defined on R, hence their product is defined on R",
        theoremFr: "Un polynôme et e^x sont définis sur R, donc le produit l’est sur R",
        theoremAr: "كثير الحدود و e^x معرفان على R فالجداء معرف على R",
        explanationEn: "Show that D_f = R: x−1 is polynomial and e^x is defined on R. Do not invent a restriction. Domain comes before any limit or derivative.",
        explanationFr: "Montrer que D_f = R : x−1 est polynomiale et e^x est définie sur R. On n’invente aucune restriction. L’ensemble de définition précède toute limite ou dérivée.",
        explanationAr: "بيّن أن D_f = R. لا تخترع قيداً. مجموعة التعريف قبل أي نهاية أو مشتق.",
        boxed: true,
      },
      {
        title: "Limits at the boundaries & asymptote",
        titleFr: "Limites aux bornes et asymptote",
        titleAr: "النهايات عند الأطراف والمستقيم المقارب",
        examVerbEn: "Calculate",
        examVerbFr: "Calculer",
        latex: "\\lim_{x\\to-\\infty}f(x)=0,\\quad y=0;\\quad \\lim_{x\\to+\\infty}f(x)=+\\infty",
        theoremEn: "Indeterminate form (−∞)×0 rewritten; growth comparison t^n/e^t → 0",
        theoremFr: "Forme indéterminée (−∞)×0 réécrite ; croissance comparée t^n/e^t → 0",
        theoremAr: "شكل غير معيّن (−∞)×0 يُعاد كتابته؛ مقارنة النمو",
        explanationEn: "Calculate both limits. At −∞ the form is (−∞)×0: set t=−x, f(−t)=−(t+1)/e^t → 0. Deduce the horizontal asymptote y=0 (write the equation, not only the word). At +∞ both factors → +∞ so f → +∞. Never leave (−∞)×0.",
        explanationFr: "Calculer les deux limites. En −∞ la forme est (−∞)×0 : t=−x, f(−t)=−(t+1)/e^t → 0. En déduire l’asymptote horizontale y=0 (écrire l’équation). En +∞ les deux facteurs → +∞. Ne jamais laisser (−∞)×0.",
        explanationAr: "احسب النهايتين. عند −∞ أعد الكتابة. استنتج y=0. لا تترك (−∞)×0.",
        boxed: true,
      },
      {
        title: "Derivative, sign, table of variations",
        titleFr: "Dérivée, signe, tableau de variation",
        titleAr: "المشتق والإشارة وجدول التغيرات",
        examVerbEn: "Calculate",
        examVerbFr: "Calculer",
        latex: `f'(x)=x e^{x},\\quad ${variation}`,
        theoremEn: "Product rule (uv)'=u'v+uv' with u=x−1, v=e^x",
        theoremFr: "Règle du produit (uv)'=u'v+uv' avec u=x−1, v=e^x",
        theoremAr: "قانون الجداء u=x−1، v=e^x",
        explanationEn: "Calculate f'(x): u=x−1, u'=1, v=e^x, v'=e^x, so f'=e^x+(x−1)e^x=x e^x. e^x>0 always, hence f' has the sign of x. Table of variations: arrows, limits, and images — f decreases on (−∞,0] from 0 to −1, then increases to +∞.",
        explanationFr: "Calculer f'(x) : u=x−1, v=e^x, f'=e^x+(x−1)e^x=x e^x. e^x>0, donc f' a le signe de x. Tableau de variation avec flèches, limites et images.",
        explanationAr: "احسب f'(x)=x e^x. إشارة f' كإشارة x. جدول التغيرات بالأسهم والصور.",
      },
      {
        title: "Particular points, IVT, graph of C_f",
        titleFr: "Points particuliers, TVI, allure de C_f",
        titleAr: "النقاط الخاصة ومبرهنة القيم الوسطية ورسم C_f",
        examVerbEn: "Deduce",
        examVerbFr: "En déduire",
        latex: "f(0)=-1,\\quad f(1)=0,\\quad \\min(0,-1)",
        theoremEn: "Intermediate Value Theorem: continuity on an interval AND strict monotonicity before concluding a unique root",
        theoremFr: "Théorème des valeurs intermédiaires : continuité ET monotonie stricte avant de conclure une racine unique",
        theoremAr: "مبرهنة القيم الوسطية: الاستمرار والتزايد/التناقص الصارم قبل الاستنتاج",
        explanationEn: "Deduce the intercepts: f(1)=0 (x-axis) and f(0)=−1 (global minimum). f is continuous on R. On (−∞,0] it is strictly decreasing from 0 to −1; on [0,+∞) strictly increasing from −1 to +∞. For m=−1/2 ∈ (−1,0), IVT plus monotonicity gives exactly two roots. Sketch C_f with y=0, (1,0), (0,−1).",
        explanationFr: "En déduire les points : f(1)=0 et le minimum (0,−1). f est continue sur R, strictement monotone sur chaque morceau. Pour m=−1/2 ∈ (−1,0), le TVI plus la monotonie donnent deux racines. Tracer C_f.",
        explanationAr: "استنتج (1,0) والحد الأدنى (0,−1). الاستمرار والرتابة قبل مبرهنة القيم الوسطية. ارسم C_f.",
        boxed: true,
      },
    ],
    graph: {
      fn: "(x-1)*exp(x)",
      domain: [-4, 2],
      yDomain: [-2, 6],
      highlights: { roots: [[1, 0]], extrema: [[0, -1]], asymptotes: [{ y: 0 }] },
    },
    trap: {
      wrong: "Writing (−∞)×0=0, or writing f'(x)=e^x as if (x−1) were constant, or applying IVT without continuity and monotonicity.",
      wrongFr: "Écrire (−∞)×0=0, ou f'(x)=e^x comme si (x−1) était constant, ou appliquer le TVI sans continuité ni monotonie.",
      correction: "Rewrite the limit as a quotient; expand u'v+uv'; state continuity + monotonicity before IVT. Box D_f=R, y=0, f'(x)=x e^x, min (0,−1).",
      correctionFr: "Réécrire la limite en quotient ; développer u'v+uv' ; continuité + monotonie avant le TVI. Encadrer D_f=R, y=0, f'(x)=x e^x, min (0,−1).",
      latex: "f'(x)=x e^{x},\\ y=0,\\ \\min(0,-1)",
    },
    topic: "Exponential functions",
    topicTag: "exponential",
    given: {
      latex: "f(x)=(x-1)e^{x}",
      aimEn: "Show that D_f=R. Calculate the limits and deduce y=0. Calculate f' and the table of variations. Deduce the minimum and sketch C_f.",
      aimFr: "Montrer que D_f=R. Calculer les limites et en déduire y=0. Calculer f' et le tableau de variation. En déduire le minimum et tracer C_f.",
      aimAr: "بيّن أن D_f=R. احسب النهايات واستنتج y=0. احسب المشتق وجدول التغيرات. استنتج الحد الأدنى وارسم C_f.",
    },
    track,
    language,
    source: "demo",
  });
}

function limitSolution(question: string, language: LessonLanguage, track: CertificateTrack): MathSolution {
  const n = normalize(question).toLowerCase();
  if (/sin|سن/.test(n) && /x/.test(n)) {
    return assembleSolution({
      question: "lim_{x→0} (sin x)/x",
      summary: "Standard trigonometric limit (Terminale / SAT).",
      finalAnswer: "1",
      finalAnswerLatex: "\\lim_{x\\to 0}\\dfrac{\\sin x}{x}=1",
      steps: [
        {
          title: "Indeterminate form",
          titleFr: "Forme indéterminée",
          latex: "\\dfrac{0}{0}",
          explanationEn: "Direct substitution gives 0/0. Name the form before using a theorem.",
          explanationFr: "La substitution donne 0/0. On nomme la forme avant le théorème.",
        },
        {
          title: "Standard limit",
          titleFr: "Limite du cours",
          latex: "\\lim_{x\\to 0}\\dfrac{\\sin x}{x}=1",
          explanationEn: "This is a theorem (squeeze / geometric argument), not a calculator result. Radians.",
          explanationFr: "Théorème (encadrement), pas un résultat de calculatrice. En radians.",
        },
        {
          title: "Check neighbouring values",
          titleFr: "Valeurs voisines",
          latex: "\\dfrac{\\sin 0.1}{0.1}\\approx 0.998",
          explanationEn: "A numerical check supports the theorem; it does not replace the proof on an official paper.",
          explanationFr: "Un contrôle numérique appuie le théorème ; il ne remplace pas la preuve.",
        },
      ],
      graph: { fn: "sin(x)/x", domain: [-6, 6], yDomain: [-0.5, 1.2], highlights: { extrema: [[0, 1]] } },
      trap: {
        wrong: "Writing sin x ≈ x and cancelling without naming the standard limit, or using degrees.",
        wrongFr: "Écrire sin x ≈ x sans nommer la limite du cours, ou travailler en degrés.",
        correction: "State the theorem in radians, then box 1.",
        correctionFr: "Énoncer le théorème en radians, puis encadrer 1.",
        latex: "\\lim_{x\\to 0}\\dfrac{\\sin x}{x}=1",
      },
      topic: "Limits",
      topicTag: "limits",
      given: {
        latex: "\\lim_{x\\to 0}\\dfrac{\\sin x}{x}",
        aimEn: "Evaluate the standard trigonometric limit.",
        aimAr: "حساب نهاية الجيب المعيارية.",
      },
      track,
      language,
      source: "demo",
    });
  }

  const rational = n.match(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/);
  if (rational || /x\^2/.test(n)) {
    return assembleSolution({
      question: "lim_{x→∞} (3x^2+1)/(x^2-2)",
      summary: "Rational limit at infinity — divide by the highest power of x.",
      finalAnswer: "3",
      finalAnswerLatex: "\\lim_{x\\to\\infty}\\dfrac{3x^{2}+1}{x^{2}-2}=3",
      steps: [
        {
          title: "Domain of the rational expression",
          titleFr: "Ensemble de définition",
          examVerbEn: "Show that",
          examVerbFr: "Montrer que",
          latex: "x^{2}-2\\neq 0\\iff x\\neq\\pm\\sqrt{2}",
          theoremEn: "A rational function is defined where the denominator is not zero",
          theoremFr: "Une fonction rationnelle est définie où le dénominateur ne s’annule pas",
          explanationEn: "Show that the expression is defined for |x| large: at infinity we stay away from x=±√2. Domain first, then the limit.",
          explanationFr: "Montrer que l’expression est définie pour |x| grand : à l’infini on s’éloigne de x=±√2. D_f d’abord, puis la limite.",
        },
        {
          title: "Highest power",
          titleFr: "Plus haute puissance",
          examVerbEn: "Calculate",
          examVerbFr: "Calculer",
          latex: "\\text{divide by }x^{2}",
          explanationEn: "At infinity, a rational function behaves like the ratio of leading terms. Factor x^2.",
          explanationFr: "À l’infini, le rationnel se comporte comme le rapport des termes de plus haut degré.",
        },
        {
          title: "Algebra",
          titleFr: "Algèbre",
          latex: "\\dfrac{3+1/x^{2}}{1-2/x^{2}}",
          explanationEn: "Each remaining term 1/x^2 → 0. Do not pick coefficients without writing this line.",
          explanationFr: "Chaque 1/x^2 → 0. On n’extrait pas les coefficients sans cette ligne.",
        },
        {
          title: "Evaluate",
          titleFr: "Passer à la limite",
          latex: "\\dfrac{3+0}{1-0}=3",
          explanationEn: "Box 3. Leading-coefficient shortcut is allowed only after the division is shown.",
          explanationFr: "On encadre 3. Le raccourci des coefficients n’est licite qu’après la division.",
        },
      ],
      graph: { fn: "(3*x*x + 1)/(x*x - 2)", domain: [-6, 6], yDomain: [-2, 8], highlights: { asymptotes: [{ y: 3 }] } },
      examTip: {
        en: "Key Idea / Exam Tip: at infinity, divide by the highest power of x. Never write ∞/∞ = 1, and never cancel x² as if it were a number. Write the horizontal asymptote y=3.",
        fr: "Idée clé : à l’infini, diviser par la plus haute puissance de x. Ne jamais écrire ∞/∞ = 1. Écrire l’asymptote horizontale y=3.",
        ar: "الفكرة: عند اللانهاية اقسم على أعلى قوة. اكتب y=3.",
      },
      studyKind: "limits",
      asymptotes: [{ kind: "horizontal", equation: "y=3" }],
      trap: {
        wrong: "Writing ∞/∞ = 1, or cancelling x^2 as if it were a number.",
        wrongFr: "Écrire ∞/∞ = 1, ou simplifier x^2 comme un nombre.",
        correction: "Divide by the highest power, then take the limit of each term.",
        correctionFr: "Diviser par la plus haute puissance, puis passer à la limite terme à terme.",
        latex: "\\lim=3",
      },
      topic: "Limits at infinity",
      topicTag: "limits",
      given: {
        latex: "\\lim_{x\\to\\infty}\\dfrac{3x^{2}+1}{x^{2}-2}",
        aimEn: "Evaluate the rational limit at infinity.",
        aimAr: "حساب نهاية الكسر عند اللانهاية.",
      },
      track,
      language,
      source: "demo",
    });
  }

  return assembleSolution({
    question,
    summary: "Limit problem — rewrite before substituting when the form is indeterminate.",
    finalAnswer: "See the graded steps (demo engine).",
    finalAnswerLatex: "\\text{rewrite, then substitute}",
    steps: [
      { title: "Name the form", titleFr: "Nommer la forme", latex: "\\text{indeterminate?}", explanationEn: "Substitute first. If you get a number, stop. If you get 0/0 or ∞/∞, rewrite.", explanationFr: "Substituer. Un nombre : on s’arrête. 0/0 ou ∞/∞ : on réécrit." },
      { title: "Rewrite", titleFr: "Réécrire", latex: "\\text{factor / conjugate / divide}", explanationEn: "Factor, conjugate, or divide by the highest power — the three Terminale tools.", explanationFr: "Factoriser, conjuguer, ou diviser par la plus haute puissance." },
      { title: "Conclude", titleFr: "Conclure", latex: "\\lim f(x)=L", explanationEn: "Name L and, if required, the theorem used.", explanationFr: "On nomme L et le théorème utilisé." },
    ],
    topic: "Limits",
    topicTag: "limits",
    track,
    language,
    source: "demo",
  });
}

function derivativeSolution(question: string, language: LessonLanguage, track: CertificateTrack): MathSolution {
  const n = normalize(question);
  if (/\(x-1\)\s*\*?\s*e\^x|(x-1)e\^x/i.test(n)) return exponentialSolution(language, track);
  if (/x\^2/.test(n) || /تربيع/.test(n)) {
    return assembleSolution({
      question: "f(x)=x^2. Find f'(x).",
      summary: "Power rule on a monomial — Brevet / SAT / Terminale.",
      finalAnswer: "f'(x)=2x",
      finalAnswerLatex: "f'(x)=2x",
      steps: [
        {
          title: "Power rule",
          titleFr: "Règle des puissances",
          latex: "(x^{n})'=n x^{n-1}",
          explanationEn: "Hypothesis: n is constant. For n=2, (x^2)'=2x.",
          explanationFr: "Hypothèse : n constant. Pour n=2, (x^2)'=2x.",
        },
        {
          title: "Apply",
          titleFr: "Application",
          latex: "f'(x)=2x",
          explanationEn: "Write the line. Do not skip from x^2 to 2x in the margin only.",
          explanationFr: "On écrit la ligne. Pas de saut dans la marge.",
        },
        {
          title: "Check at a point",
          titleFr: "Contrôle en un point",
          latex: "f'(1)=2",
          explanationEn: "The slope of y=x^2 at x=1 is 2, matching the tangent 2x−1.",
          explanationFr: "La pente de y=x^2 en x=1 vaut 2.",
        },
      ],
      graph: { fn: "x*x", domain: [-3, 3], highlights: { extrema: [[0, 0]] } },
      trap: {
        wrong: "Writing (x^2)'=x, or applying the rule to e^x as if it were a power of x.",
        wrongFr: "Écrire (x^2)'=x, ou appliquer la règle à e^x.",
        correction: "Power rule is for x^n with n constant. Exponential has its own theorem.",
        correctionFr: "La règle des puissances est pour x^n. L’exponentielle a son théorème.",
        latex: "f'(x)=2x",
      },
      topic: "Derivatives",
      track,
      language,
      source: "demo",
    });
  }
  return assembleSolution({
    question,
    summary: "Derivative: name the rule (sum, product, quotient, chain) with its hypothesis.",
    finalAnswer: "See the graded derivative lines.",
    finalAnswerLatex: "f'(x)\\ \\text{by a named rule}",
    steps: [
      { title: "Identify the form", titleFr: "Reconnaître la forme", latex: "f=u\\pm v\\text{ or }uv\\text{ or }u/v\\text{ or }u\\circ v", explanationEn: "Pick one named rule. Mixing two rules on the same line is an official-exam trap.", explanationFr: "Une seule règle nommée. Mélanger deux règles sur la même ligne est un piège." },
      { title: "Differentiate", titleFr: "Dériver", latex: "f'(x)=\\ldots", explanationEn: "Copy the formula with u and v, then substitute.", explanationFr: "On recopie la formule avec u et v, puis on substitue." },
      { title: "Simplify", titleFr: "Simplifier", latex: "f'(x)=\\text{factored form}", explanationEn: "Factor common terms so the sign chart is readable.", explanationFr: "Factoriser pour le tableau de signes." },
    ],
    graph: { fn: "x*x", domain: [-3, 3] },
    topic: "Derivatives",
    track,
    language,
    source: "demo",
  });
}

function pythagorasSolution(language: LessonLanguage, track: CertificateTrack): MathSolution {
  return assembleSolution({
    question: "A right triangle has legs 3 and 4. Find the hypotenuse.",
    summary: "Pythagoras (Brevet geometry).",
    finalAnswer: "5",
    finalAnswerLatex: "c=5",
    steps: [
      {
        title: "Name the theorem",
        titleFr: "Nommer le théorème",
        latex: "a^{2}+b^{2}=c^{2}",
        examVerbEn: "Show that",
        examVerbFr: "Montrer que",
        explanationEn: "Right angle required. Legs a,b; hypotenuse c opposite the right angle. Interpret geometrically: c is the length of the hypotenuse.",
        explanationFr: "Angle droit requis. a,b côtés de l’angle droit ; c hypoténuse.",
      },
      {
        title: "Substitute",
        titleFr: "Substituer",
        latex: "3^{2}+4^{2}=c^{2}",
        explanationEn: "9+16=25. This 3-4-5 triple appears on Lebanese Brevet papers.",
        explanationFr: "9+16=25. Le triplet 3-4-5 est un classique du Brevet libanais.",
      },
      {
        title: "Positive root",
        titleFr: "Racine positive",
        latex: "c=\\sqrt{25}=5",
        explanationEn: "Length is positive. Box 5 and, if asked, the unit.",
        explanationFr: "Une longueur est positive. On encadre 5.",
      },
    ],
    graph: { fn: "sqrt(25-x*x)", domain: [0, 5], highlights: { roots: [[3, 4]] } },
    examTip: {
      en: "Key Idea / Exam Tip: name the right angle before Pythagoras. Interpret geometrically: c is the hypotenuse, a length, hence positive.",
      fr: "Idée clé : nommer l’angle droit avant Pythagore. Interpréter géométriquement : c est l’hypoténuse, une longueur, donc positive.",
      ar: "الفكرة: سمِّ الزاوية القائمة قبل فيثاغورس. الوتر طول موجب.",
    },
    studyKind: "geometry",
    trap: {
      wrong: "Adding 3+4=7, or forgetting that c is opposite the right angle.",
      wrongFr: "Ajouter 3+4=7, ou se tromper d’hypoténuse.",
      correction: "Squares, then the positive square root. Check 3²+4²=5².",
      correctionFr: "Les carrés, puis la racine positive. Contrôle 3²+4²=5².",
      latex: "c=5",
    },
    topic: "Right triangles",
    topicTag: "geometry",
    given: {
      latex: "a=3,\\ b=4,\\ \\widehat{C}=90^{\\circ}",
      aimEn: "Find the hypotenuse c.",
      aimAr: "إيجاد الوتر c.",
    },
    track,
    language,
    source: "demo",
  });
}

function percentSolution(question: string, language: LessonLanguage, track: CertificateTrack): MathSolution {
  return assembleSolution({
    question: question || "Increase 200 by 15%.",
    summary: "Percentage change (Brevet arithmetic).",
    finalAnswer: "230",
    finalAnswerLatex: "200\\times 1.15=230",
    steps: [
      { title: "Write the multiplier", titleFr: "Écrire le coefficient", latex: "1+\\dfrac{15}{100}=1.15", explanationEn: "An increase of p% is multiplication by 1+p/100, not addition of p.", explanationFr: "Une hausse de p% est une multiplication par 1+p/100." },
      { title: "Multiply", titleFr: "Multiplier", latex: "200\\times 1.15=230", explanationEn: "Keep the base. SAT/Brevet traps use the increased value as a new base without saying so.", explanationFr: "On garde la base. Piège : reprendre 230 comme nouvelle base sans le dire." },
      { title: "Check", titleFr: "Contrôle", latex: "200+0.15\\times 200=230", explanationEn: "Equivalent form: original plus 15% of original.", explanationFr: "Forme équivalente : original plus 15% de l’original." },
    ],
    topic: "Percentages",
    track,
    language,
    source: "demo",
  });
}

function genericSolution(question: string, language: LessonLanguage, track: CertificateTrack, extra?: string): MathSolution {
  return assembleSolution({
    question,
    summary: extra || "Lebanese-curriculum worked method: given, rule, algebra, check.",
    finalAnswer: "Worked on the board — follow the four graded lines.",
    finalAnswerLatex: "\\text{given }\\to\\text{ rule }\\to\\text{ algebra }\\to\\text{ check}",
    steps: [
      {
        title: "Copy the given",
        titleFr: "Recopier les données",
        titleAr: "كتابة المعطيات",
        latex: question.slice(0, 80) || "\\text{given}",
        explanationEn: "Prof. Munzer Haddara’s barème starts with the given on the first line, never with a memorized number.",
        explanationFr: "Le barème du Prof. Munzer Haddara commence par les données, jamais par un nombre mémorisé.",
        explanationAr: "نبدأ بالمعطيات لا بالرقم المحفوظ.",
      },
      {
        title: "Name the rule",
        titleFr: "Nommer la règle",
        latex: "\\text{theorem + hypothesis}",
        explanationEn: "Discriminant, product rule, Pythagoras, similar triangles, standard limit… name it and its hypothesis.",
        explanationFr: "Discriminant, produit, Pythagore, triangles semblables, limite du cours… on nomme l’hypothèse.",
      },
      {
        title: "Algebra then check",
        titleFr: "Algèbre puis contrôle",
        latex: "\\text{substitute / factor / simplify}",
        explanationEn: "One operation per line. Substitute back when the unknown is found.",
        explanationFr: "Une opération par ligne. Substituer une fois l’inconnue trouvée.",
      },
    ],
    graph: { fn: "x", domain: [-3, 3] },
    warning: extra,
    topic: "General method",
    track,
    language,
    source: "demo",
  });
}

export function demoSolve(request: SolveRequest): MathSolution {
  const language: LessonLanguage = request.language === "fr" ? "fr" : request.language === "ar" ? "ar" : "en";
  const track: CertificateTrack = request.track ?? "ls";
  const raw = `${request.latex ?? ""} ${request.question ?? ""}`.trim();
  const n = normalize(raw).toLowerCase();

  if (isGarbledPrompt(raw)) {
    return retakeSolution({
      question: raw,
      language,
      imageName: request.imageName,
      source: "demo",
    });
  }

  if (/\(x-1\)\s*\*?\s*e\^x|(x-1)e\^x|أسي.*\(x-1\)/i.test(n) || (/exp/.test(n) && /x-1/.test(n))) {
    return exponentialSolution(language, track);
  }
  if (/lim|نهاية|limite/.test(n)) return limitSolution(raw, language, track);
  if (/f'\s*\(|derive|derivative|اشتق|dériv/.test(n)) return derivativeSolution(raw, language, track);
  if (/hypoten|فيثاغور|pythag|3\s*(and|,)\s*4/.test(n) || /legs 3 and 4/.test(n)) {
    return pythagorasSolution(language, track);
  }
  if (/%|percent|نسبة|زيادة/.test(n)) return percentSolution(raw, language, track);

  const system = parseSystem(raw);
  if (system) return systemSolution(system.r1, system.r2, language, track === "sat" ? "sat" : "brevet");

  const quad = parseQuadratic(raw);
  if (quad) return quadraticSolution(quad.a, quad.b, quad.c, language, track === "sat" ? "sat" : "brevet");

  const linear = parseLinear(raw);
  if (linear) return linearSolution(linear.a, linear.b, linear.c, language, track);

  if (/complex|مركب|argand/.test(n)) {
    return assembleSolution({
      question: raw || "z = 3+4i. Find |z|.",
      summary: "Modulus of a complex number (Terminale).",
      finalAnswer: "|z|=5",
      finalAnswerLatex: "|z|=\\sqrt{3^{2}+4^{2}}=5",
      steps: [
        { title: "Definition", titleFr: "Définition", examVerbEn: "Show that", examVerbFr: "Montrer que", latex: "z=a+ib,\\quad |z|=\\sqrt{a^{2}+b^{2}}", explanationEn: "Complex form z=a+ib. |z| is the Euclidean length of the vector on the Argand plane. Interpret geometrically.", explanationFr: "Forme algébrique z=a+ib. |z| est la longueur du vecteur dans le plan d’Argand. Interpréter géométriquement." },
        { title: "Substitute", titleFr: "Substituer", latex: "\\sqrt{9+16}=\\sqrt{25}", explanationEn: "a=3, b=4 — the same 3-4-5 numbers as Pythagoras.", explanationFr: "a=3, b=4 — le triplet 3-4-5." },
        { title: "Positive root", titleFr: "Racine positive", latex: "|z|=5", explanationEn: "A modulus is never negative.", explanationFr: "Un module n’est jamais négatif." },
      ],
      graph: { fn: "0", domain: [-1, 5], highlights: { roots: [[3, 4]] } },
      examTip: {
        en: "Key Idea / Exam Tip: write z = a + ib first. The modulus is a length. Never claim |z₁+z₂|=|z₁|+|z₂| always.",
        fr: "Idée clé : écrire z = a + ib d’abord. Le module est une longueur. Ne jamais affirmer |z₁+z₂|=|z₁|+|z₂| toujours.",
        ar: "الفكرة: اكتب z=a+ib أولاً. الطويلة طول.",
      },
      studyKind: "complex",
      topic: "Complex numbers",
      topicTag: "complex",
      given: {
        latex: "z=3+4i",
        aimEn: "Find the modulus |z|.",
        aimAr: "إيجاد طويلة z.",
      },
      track,
      language,
      source: "demo",
    });
  }

  if (/integral|\\int|تكامل|intégr/.test(n)) {
    return assembleSolution({
      question: raw || "∫ 2x dx",
      summary: "Antiderivative: reverse the power rule, then +C.",
      finalAnswer: "x^2 + C",
      finalAnswerLatex: "\\int 2x\\,dx=x^{2}+C",
      steps: [
        { title: "Reverse power rule", titleFr: " Primitive de puissance", latex: "\\int x^{n}\\,dx=\\dfrac{x^{n+1}}{n+1}+C", explanationEn: "For n=1, ∫x dx = x^2/2 + C, so ∫2x dx = x^2+C.", explanationFr: "Pour n=1, ∫x dx = x^2/2 + C." },
        { title: "Constant factor", titleFr: "Facteur constant", latex: "2\\cdot\\dfrac{x^{2}}{2}=x^{2}", explanationEn: "Constants factor out of the integral.", explanationFr: "Les constantes sortent de l’intégrale." },
        { title: "Differentiate back", titleFr: "Revérifier par dérivation", latex: "(x^{2}+C)'=2x", explanationEn: "The official check of an antiderivative is differentiation.", explanationFr: "Le contrôle officiel d’une primitive est la dérivation." },
      ],
      topic: "Integrals",
      topicTag: "integrals",
      given: {
        latex: "\\int 2x\\,dx",
        aimEn: "Find the antiderivative (+C).",
        aimAr: "إيجاد الدالة الأصلية (+C).",
      },
      track,
      language,
      source: "demo",
    });
  }

  return genericSolution(raw || "Show a complete Lebanese-curriculum solution.", language, track);
}
