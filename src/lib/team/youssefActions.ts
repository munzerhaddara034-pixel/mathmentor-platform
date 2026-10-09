import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { createId } from "@/lib/ids";
import { teamMessages } from "@/lib/i18n/ns/team";
import { parseJsonObject, stringField } from "./gemini";

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

function designBrief(): YoussefDesignBrief {
  return {
    palette: ["#0f172a", "#0f766e", "#f8fafc", "#f59e0b"],
    typographyScale: ["14px نص مساعد", "18px نص أساسي", "28px عنوان القسم", "clamp(32px, 8vw, 56px) عنوان رئيسي"],
    spacing: ["8px وحدة صغيرة", "16px بين العناصر", "24px حشو البطاقات", "48px بين الأقسام"],
  };
}

function renderDesignHtml(title: string, brief: YoussefDesignBrief): string {
  const safeTitle = escapeHtml(title);
  const palette = brief.palette.map(escapeHtml);
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} · MathMentor</title>
<style>
:root{--ink:${palette[0]};--accent:${palette[1]};--surface:${palette[2]};--gold:${palette[3]};font-family:Tahoma,Arial,sans-serif;color:var(--ink);background:var(--surface)}
*{box-sizing:border-box}body{margin:0;min-width:320px;background:linear-gradient(135deg,#fff 0%,var(--surface) 70%)}main{max-width:1120px;margin:auto;padding:24px clamp(16px,5vw,64px) 64px}.eyebrow{color:var(--accent);font-size:14px;font-weight:700;letter-spacing:.06em}.hero{display:grid;gap:24px;padding:48px 0 40px}.hero h1{font-size:clamp(32px,8vw,56px);line-height:1.08;margin:0;max-width:720px}.hero p{font-size:18px;line-height:1.8;max-width:640px;color:#475569}.actions{display:flex;flex-wrap:wrap;gap:12px}.button{border:0;border-radius:999px;padding:14px 22px;background:var(--accent);color:#fff;font-weight:700}.button.alt{background:transparent;color:var(--accent);border:1px solid var(--accent)}section{scroll-margin-top:24px}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin:24px 0}.section-head h2{font-size:28px;margin:0}.section-head p{color:#64748b;margin:0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card{background:#fff;border:1px solid #dbe4ee;border-radius:20px;padding:24px;box-shadow:0 12px 30px #0f172a12}.card.featured{border:2px solid var(--gold);transform:translateY(-4px)}.card h3{margin:0 0 12px;font-size:20px}.price{font-size:36px;font-weight:800;color:var(--accent);margin:12px 0}.card ul{padding:0 20px 0 0;line-height:2;color:#475569}.badge{display:inline-block;background:#fef3c7;color:#92400e;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700}.footer{border-top:1px solid #dbe4ee;margin-top:48px;padding-top:24px;color:#64748b;font-size:14px}@media (min-width:700px){.hero{grid-template-columns:1.2fr .8fr;align-items:center}.hero::after{content:"";display:block;min-height:220px;border-radius:36px;background:radial-gradient(circle at 30% 30%,#f59e0b66,transparent 32%),linear-gradient(145deg,var(--accent),var(--ink));box-shadow:0 24px 60px #0f172a33}}
</style>
</head>
<body><main>
<header class="hero"><div><p class="eyebrow">منذر حداره · MathMentor</p><h1>${safeTitle}</h1><p>تجربة تعليمية عربية واضحة، مصمّمة لتساعد الطالب على الفهم خطوة بخطوة واتخاذ القرار بثقة.</p><div class="actions"><button class="button">ابدأ الآن</button><button class="button alt">اكتشف التفاصيل</button></div></div></header>
<section aria-labelledby="design-section"><div class="section-head"><div><p class="eyebrow">التصميم المقترح</p><h2 id="design-section">${safeTitle}</h2></div><span class="badge">RTL · Mobile first</span></div><div class="cards"><article class="card"><h3>خطة البداية</h3><p class="price">مجاني</p><ul><li>تجربة واضحة وسريعة</li><li>شرح منظم لكل خطوة</li><li>مناسب للموبايل</li></ul><button class="button">اختَر الخطة</button></article><article class="card featured"><span class="badge">الأكثر اختياراً</span><h3>خطة التقدّم</h3><p class="price">$19</p><ul><li>حلول موثّقة خطوة بخطوة</li><li>سبورة تفاعلية وفيديو شرح</li><li>دعم للمناهج اللبنانية</li></ul><button class="button">ابدأ التعلّم</button></article><article class="card"><h3>خطة المدرسة</h3><p class="price">مخصّصة</p><ul><li>إدارة صفوف وطلاب</li><li>تقارير تقدّم للأهل</li><li>تواصل مع الأستاذ</li></ul><button class="button">اطلب عرضاً</button></article></div></section>
<footer class="footer">نموذج تصميم داخلي للمراجعة — لا نشر أو اعتماد قبل موافقة منذر حداره.</footer>
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

export async function createYoussefDesign(requestText: string, requestedTitle?: string): Promise<YoussefDesignArtifact> {
  const request = str(requestText, 280) || "تصميم صفحة MathMentor";
  const title = str(requestedTitle, 180) || subjectFromRequest(request);
  const brief = designBrief();
  const now = new Date().toISOString();
  const artifact: YoussefDesignArtifact = {
    id: createId("design"),
    request,
    title,
    html: renderDesignHtml(title, brief),
    brief,
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
  return Array.isArray(store.designs) ? store.designs : [];
}

/** Parses Youssef's structured response and creates an internal design when a page/section is requested. */
export async function applyYoussefActions(reply: string, requestText = ""): Promise<YoussefActionResult> {
  const block = reply.match(/```ys-actions\s*([\s\S]*?)```/);
  const data = parseJsonObject(block?.[1] ?? reply);
  if (!wantsDesign(requestText, data)) return { text: reply, recorded: [] };
  const artifact = await createYoussefDesign(requestedDesign(data, requestText));
  const clean = block ? reply.replace(block[0], "").trim() : stringField(data, "reply").trim() || reply;
  return {
    text: clean,
    recorded: [actionText("designSaved", { id: artifact.id })],
    design: artifact,
  };
}
