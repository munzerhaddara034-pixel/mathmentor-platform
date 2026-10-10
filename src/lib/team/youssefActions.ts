import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { createId } from "@/lib/ids";
import { teamMessages } from "@/lib/i18n/ns/team";
import { parseJsonObject, stringField } from "./gemini";
import { defaultContentLanguage, resolveContentLanguage } from "@/lib/contentLanguage";

const DESIGNS_FILE = "youssef-designs.json";
const DESIGN_LIMIT = 40;

export type YoussefDesignBrief = {
  palette: string[];
  typographyScale: string[];
  spacing: string[];
};

export type YoussefDesignArtifact = {
  id: string;
  request: string;
  title: string;
  html: string;
  brief: YoussefDesignBrief;
  language: "en" | "ar" | "fr";
  createdAt: string;
  updatedAt: string;
};

type DesignStore = { designs: YoussefDesignArtifact[] };

export type YoussefActionResult = {
  text: string;
  recorded: string[];
  design?: YoussefDesignArtifact;
};

function actionText(key: keyof typeof teamMessages.ar.actions, values: Record<string, string> = {}): string {
  let text = teamMessages.ar.actions[key];
  for (const [name, value] of Object.entries(values)) text = text.replace(`{${name}}`, value);
  return text;
}

function str(value: unknown, max = 280): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function subjectFromRequest(request: string): string {
  const clean = request.replace(/^\s*(?:يوسف|youssef|yousef|سامي|sami)\s*[,،:：-]?\s*/i, "").trim();
  const match = clean.match(/(?:صمّم|صمم|صممي|صمّملي|صمّم لي|design|create)\s+([\s\S]+)/i);
  return (match?.[1] ?? clean).replace(/[.!؟]+$/, "").trim().slice(0, 180) || "صفحة MathMentor";
}

function designBrief(language: "en" | "ar" | "fr"): YoussefDesignBrief {
  if (language === "ar") {
    return {
      palette: ["#0f172a", "#0f766e", "#f8fafc", "#f59e0b"],
      typographyScale: ["14px نص مساعد", "18px نص أساسي", "28px عنوان القسم", "clamp(32px, 8vw, 56px) عنوان رئيسي"],
      spacing: ["8px وحدة صغيرة", "16px بين العناصر", "24px حشو البطاقات", "48px بين الأقسام"],
    };
  }
  if (language === "fr") {
    return {
      palette: ["#0f172a", "#0f766e", "#f8fafc", "#f59e0b"],
      typographyScale: ["14px texte secondaire", "18px texte courant", "28px titre de section", "clamp(32px, 8vw, 56px) titre principal"],
      spacing: ["8px petite unité", "16px entre éléments", "24px marge des cartes", "48px entre sections"],
    };
  }
  return {
    palette: ["#0f172a", "#0f766e", "#f8fafc", "#f59e0b"],
    typographyScale: ["14px supporting text", "18px body text", "28px section heading", "clamp(32px, 8vw, 56px) hero heading"],
    spacing: ["8px small unit", "16px between elements", "24px card padding", "48px between sections"],
  };
}

function renderDesignHtml(title: string, brief: YoussefDesignBrief, language: "en" | "ar" | "fr"): string {
  const safeTitle = escapeHtml(title);
  const palette = brief.palette.map(escapeHtml);
  const arabic = language === "ar";
  const french = language === "fr";
  const copy = arabic
    ? {
        brand: "منذر حداره · MathMentor",
        intro: "تجربة تعليمية واضحة، مصمّمة لتساعد الطالب على الفهم خطوة بخطوة واتخاذ القرار بثقة.",
        cta: "ابدأ الآن",
        alt: "اكتشف التفاصيل",
        eyebrow: "التصميم المقترح",
        badge: "RTL · Mobile first",
        start: "خطة البداية",
        progress: "خطة التقدّم",
        school: "خطة المدرسة",
        free: "مجاني",
        custom: "مخصّصة",
        plan: "اختَر الخطة",
        learn: "ابدأ التعلّم",
        request: "اطلب عرضاً",
        footer: "نموذج تصميم داخلي للمراجعة — لا نشر أو اعتماد قبل موافقة منذر حداره.",
      }
    : french
      ? {
          brand: "Munzer Haddara · MathMentor",
          intro: "Une expérience d’apprentissage claire, conçue pour guider l’élève étape par étape.",
          cta: "Commencer",
          alt: "Découvrir",
          eyebrow: "Proposition de design",
          badge: "LTR · Mobile first",
          start: "Plan de départ",
          progress: "Plan progression",
          school: "Plan école",
          free: "Gratuit",
          custom: "Sur mesure",
          plan: "Choisir le plan",
          learn: "Commencer à apprendre",
          request: "Demander une offre",
          footer: "Maquette interne pour revue — aucune publication avant l’accord de Munzer Haddara.",
        }
      : {
          brand: "Munzer Haddara · MathMentor",
          intro: "A clear learning experience designed to help students understand each step and decide with confidence.",
          cta: "Start now",
          alt: "Explore details",
          eyebrow: "Proposed design",
          badge: "LTR · Mobile first",
          start: "Starter plan",
          progress: "Progress plan",
          school: "School plan",
          free: "Free",
          custom: "Custom",
          plan: "Choose plan",
          learn: "Start learning",
          request: "Request offer",
          footer: "Internal design draft for review — no publishing or approval before Munzer Haddara agrees.",
        };
  const safe = Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, escapeHtml(value)])) as Record<string, string>;
  const dir = arabic ? "rtl" : "ltr";
  return `<!doctype html>
<html lang="${language}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} · MathMentor</title>
<style>
:root{--ink:${palette[0]};--accent:${palette[1]};--surface:${palette[2]};--gold:${palette[3]};font-family:Inter,Arial,sans-serif;color:var(--ink);background:var(--surface)}
*{box-sizing:border-box}body{margin:0;min-width:320px;background:linear-gradient(135deg,#fff 0%,var(--surface) 70%)}main{max-width:1120px;margin:auto;padding:24px clamp(16px,5vw,64px) 64px}.eyebrow{color:var(--accent);font-size:14px;font-weight:700;letter-spacing:.06em}.hero{display:grid;gap:24px;padding:48px 0 40px}.hero h1{font-size:clamp(32px,8vw,56px);line-height:1.08;margin:0;max-width:720px}.hero p{font-size:18px;line-height:1.8;max-width:640px;color:#475569}.actions{display:flex;flex-wrap:wrap;gap:12px}.button{border:0;border-radius:999px;padding:14px 22px;background:var(--accent);color:#fff;font-weight:700}.button.alt{background:transparent;color:var(--accent);border:1px solid var(--accent)}section{scroll-margin-top:24px}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin:24px 0}.section-head h2{font-size:28px;margin:0}.section-head p{color:#64748b;margin:0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card{background:#fff;border:1px solid #dbe4ee;border-radius:20px;padding:24px;box-shadow:0 12px 30px #0f172a12}.card.featured{border:2px solid var(--gold);transform:translateY(-4px)}.card h3{margin:0 0 12px;font-size:20px}.price{font-size:36px;font-weight:800;color:var(--accent);margin:12px 0}.card ul{padding-inline-start:20px;line-height:2;color:#475569}.badge{display:inline-block;background:#fef3c7;color:#92400e;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700}.footer{border-top:1px solid #dbe4ee;margin-top:48px;padding-top:24px;color:#64748b;font-size:14px}@media (min-width:700px){.hero{grid-template-columns:1.2fr .8fr;align-items:center}.hero::after{content:"";display:block;min-height:220px;border-radius:36px;background:radial-gradient(circle at 30% 30%,#f59e0b66,transparent 32%),linear-gradient(145deg,var(--accent),var(--ink));box-shadow:0 24px 60px #0f172a33}}
</style>
</head>
<body><main>
<header class="hero"><div><p class="eyebrow">${safe.brand}</p><h1>${safeTitle}</h1><p>${safe.intro}</p><div class="actions"><button class="button">${safe.cta}</button><button class="button alt">${safe.alt}</button></div></div></header>
<section aria-labelledby="design-section"><div class="section-head"><div><p class="eyebrow">${safe.eyebrow}</p><h2 id="design-section">${safeTitle}</h2></div><span class="badge">${safe.badge}</span></div><div class="cards"><article class="card"><h3>${safe.start}</h3><p class="price">${safe.free}</p><ul><li>Clear, fast experience</li><li>Step-by-step explanation</li><li>Built for mobile</li></ul><button class="button">${safe.plan}</button></article><article class="card featured"><span class="badge">Recommended</span><h3>${safe.progress}</h3><p class="price">$19</p><ul><li>Verified step-by-step solutions</li><li>Interactive board and lesson video</li><li>Support for the Lebanese curriculum</li></ul><button class="button">${safe.learn}</button></article><article class="card"><h3>${safe.school}</h3><p class="price">${safe.custom}</p><ul><li>Class and student management</li><li>Progress reports for families</li><li>Teacher communication</li></ul><button class="button">${safe.request}</button></article></div></section>
<footer class="footer">${safe.footer}</footer>
</main></body></html>`;
}

function requestedDesign(data: Record<string, unknown> | null, requestText: string): string {
  const raw = data?.design ?? data?.youssefDesign;
  if (raw && typeof raw === "object") {
    const item = raw as Record<string, unknown>;
    return str(item.request, 280) || str(item.section, 180) || subjectFromRequest(requestText);
  }
  return subjectFromRequest(requestText);
}

function wantsDesign(requestText: string, data: Record<string, unknown> | null): boolean {
  if (Boolean(data?.design ?? data?.youssefDesign)) return true;
  return /(تصميم|صمّم|صمم|واجهة|صفحة|قسم|banner|poster|design|ui|ux)/i.test(requestText);
}

export async function createYoussefDesign(
  requestText: string,
  requestedTitle?: string | { language?: "en" | "ar" | "fr" },
  options: { language?: "en" | "ar" | "fr" } = {},
): Promise<YoussefDesignArtifact> {
  const titleOverride = typeof requestedTitle === "string" ? requestedTitle : undefined;
  const inlineLanguage = typeof requestedTitle === "object" && requestedTitle ? requestedTitle.language : undefined;
  const request = str(requestText, 280) || "MathMentor page design";
  const title = str(titleOverride, 180) || subjectFromRequest(request);
  // Arabic requests remain readable for legacy callers; the agent action path passes the English default explicitly.
  const inferredLanguage = /[\u0600-\u06ff]/.test(request) ? "ar" : defaultContentLanguage();
  const language = resolveContentLanguage(options.language ?? inlineLanguage ?? inferredLanguage) as "en" | "ar" | "fr";
  const brief = designBrief(language);
  const now = new Date().toISOString();
  const artifact: YoussefDesignArtifact = {
    id: createId("design"),
    request,
    title,
    html: renderDesignHtml(title, brief, language),
    brief,
    language,
    createdAt: now,
    updatedAt: now,
  };
  await updateJsonFile<DesignStore>(DESIGNS_FILE, { designs: [] }, (store) => ({
    designs: [artifact, ...store.designs.filter((item) => item.id !== artifact.id)].slice(0, DESIGN_LIMIT),
  }));
  return artifact;
}

export async function listYoussefDesigns(): Promise<YoussefDesignArtifact[]> {
  const store = await readJsonFile<DesignStore>(DESIGNS_FILE, { designs: [] });
  return Array.isArray(store.designs) ? store.designs.map((design) => ({ ...design, language: design.language ?? defaultContentLanguage() })) : [];
}

/** Parses Youssef's structured response and creates an internal design when a page/section is requested. */
export async function applyYoussefActions(reply: string, requestText = ""): Promise<YoussefActionResult> {
  const block = reply.match(/```ys-actions\s*([\s\S]*?)```/);
  const data = parseJsonObject(block?.[1] ?? reply);
  if (!wantsDesign(requestText, data)) return { text: reply, recorded: [] };
  const language = resolveContentLanguage(data?.language ?? defaultContentLanguage()) as "en" | "ar" | "fr";
  const artifact = await createYoussefDesign(requestedDesign(data, requestText), undefined, { language });
  const clean = block ? reply.replace(block[0], "").trim() : stringField(data, "reply").trim() || reply;
  return {
    text: clean,
    recorded: [actionText("designSaved", { id: artifact.id })],
    design: artifact,
  };
}
