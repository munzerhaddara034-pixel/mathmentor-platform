/**
 * School partnership proposal generator (Arabic formal + printable).
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره — never الطارة.
 */

import { geminiApiKey } from "@/lib/solver/llm";
import { INSTRUCTOR_AR, INSTRUCTOR_EN, ACADEMY_LINE } from "@/lib/pedagogy/lebanese";
import { PRICING_STUDY, schoolB2bQuote } from "./pricingStudy";
import { whishTransferNameAr, whishTransferNameEn, whishTransferPhone } from "@/lib/whish/client";

export type ProposalCurriculum = "Lebanese" | "International";

export type ProposalInput = {
  schoolName: string;
  studentCount: number;
  curriculum: ProposalCurriculum;
};

export type SchoolProposal = {
  schoolName: string;
  studentCount: number;
  curriculum: ProposalCurriculum;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyHtml: string;
  source: "gemini" | "template";
  quote: ReturnType<typeof schoolB2bQuote>;
  generatedAt: string;
};

function curriculumLabel(curriculum: ProposalCurriculum) {
  return curriculum === "Lebanese"
    ? { en: "Lebanese Official Curriculum", ar: "المنهج اللبناني الرسمي" }
    : { en: "International track", ar: "المسار الدولي" };
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphsToHtml(bodyAr: string) {
  return bodyAr
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line)).join("<br/>");
      return `<p>${lines}</p>`;
    })
    .join("\n");
}

export function buildTemplateProposal(input: ProposalInput): SchoolProposal {
  const schoolName = input.schoolName.trim() || "المدرسة الشريكة";
  const studentCount = Math.max(1, Math.round(input.studentCount) || 40);
  const quote = schoolB2bQuote(studentCount);
  const curr = curriculumLabel(input.curriculum);
  const phone = whishTransferPhone();
  const nameAr = whishTransferNameAr();
  const nameEn = whishTransferNameEn();
  const schools = PRICING_STUDY.find((r) => r.id === "schools_b2b")!;
  const digital = PRICING_STUDY.find((r) => r.id === "digital_basic")!;
  const gold = PRICING_STUDY.find((r) => r.id === "gold")!;

  const discountNote =
    quote.students >= 80
      ? "خصم شراكة سنوي مقترح: ٥٪ على الإجمالي السنوي عند التوقيع قبل بدء العام الدراسي."
      : quote.students >= 50
        ? "خصم شراكة مقترح: ٣٪ على الإجمالي السنوي عند الدفع مقدّماً لفصل كامل."
        : "يمكن مناقشة خصم تنسيقي عند الالتزام بحدّ أدنى ٤٠ طالباً طوال العام.";

  const titleAr = `عرض شراكة تعليمية — ${schoolName}`;
  const titleEn = `Partnership proposal — ${schoolName}`;

  const bodyAr = [
    `حضرة إدارة ${schoolName} المحترمة،`,
    ``,
    `تحية طيبة وبعد،`,
    ``,
    `يسرّ ${ACADEMY_LINE} ممثلةً بـ${INSTRUCTOR_AR} (${INSTRUCTOR_EN}) أن تقدّم عرض شراكة رقمية وأكاديمية لدعم طلاب الشهادة في مسار ${curr.ar}، بعدد تقريبي ${quote.students} طالباً مرشّحاً للمنصة.`,
    ``,
    `أولاً — دور المنصة في نجاح الامتحانات الرسمية`,
    `• محاكاة امتحانات رسمية (Brevet / Terminale) مع تصحيح وفق السلّم (Barème) خطوة بخطوة.`,
    `• حلّال ذكاء اصطناعي يدرّب الطالب على أسلوب الورقة الرسمية وليس على حفظ الجواب.`,
    `• سبورة تفاعلية ودروس بلا حدود + مساعد مطبوعات للمراجعة المنزلية.`,
    `• لوحة تحليلات للمنسّق المدرسي لمتابعة التقدّم والضعف حسب المحاور — مجاناً ضمن باقة المدارس.`,
    ``,
    `ثانياً — الميزات التفاعلية للشراكة المدرسية`,
    `• حسابات صفوف منفصلة بإشراف منسّق المدرسة.`,
    `• واجبات رقمية مرتبطة بالمنصة مع تتبّع الإنجاز.`,
    `• إمكانية دمج حصص مباشرة جماعية (باقة ${gold.nameAr}) للصفوف المكثّفة.`,
    ``,
    `ثالثاً — التسعير B2B المقترح لـ${schoolName}`,
    `• باقة المدارس: ${schools.priceAr} — العرض الحالي: ${quote.perStudent}$ للطالب / شهر × ${quote.students} طالباً = ${quote.monthlyTotal}$ شهرياً (حوالي ${quote.yearlyTotal}$ للسنة الدراسية ≈ ١٠ أشهر).`,
    `• للمقارنة الفردية: ${digital.nameAr} ${digital.priceAr} · ${gold.nameAr} ${gold.priceAr}.`,
    `• ${discountNote}`,
    ``,
    `رابعاً — آلية الدفع (Whish فقط)`,
    `التحويل عبر تطبيق Whish Money إلى الرقم ${phone} باسم ${nameAr} / ${nameEn}. لا تُقبل وسائل دفع أخرى. بعد التحويل يُفعَّل الحساب وتُصدر بطاقة الاشتراك من لوحة الإدارة.`,
    ``,
    `خامساً — خطوات البدء`,
    `١) اعتماد العرض وتأكيد عدد الطلاب والمسار (${curr.ar}).`,
    `٢) تحويل الدفعة الأولى عبر Whish مع رقم المرجع.`,
    `٣) تفعيل حسابات الصفوف ولوحة المنسّق خلال ٤٨ ساعة عمل.`,
    ``,
    `وتفضلوا بقبول فائق الاحترام،`,
    `${INSTRUCTOR_AR}`,
    `${INSTRUCTOR_EN}`,
    `${ACADEMY_LINE}`,
    `واتساب / Whish: ${phone}`,
  ].join("\n");

  const bodyHtml = `
<header class="b2b-proposal-header">
  <p class="eyebrow">${escapeHtml(ACADEMY_LINE)}</p>
  <h1 dir="rtl" lang="ar">${escapeHtml(titleAr)}</h1>
  <p class="muted" dir="ltr">${escapeHtml(titleEn)}</p>
  <p dir="rtl" lang="ar"><strong>المنهج:</strong> ${escapeHtml(curr.ar)} · <strong>الطلاب:</strong> ${quote.students}</p>
</header>
<article class="b2b-proposal-body" dir="rtl" lang="ar">
  ${paragraphsToHtml(bodyAr)}
</article>
<footer class="b2b-proposal-footer" dir="rtl" lang="ar">
  <p>التوقيع: ${escapeHtml(INSTRUCTOR_AR)} — ${escapeHtml(INSTRUCTOR_EN)}</p>
  <p class="muted">Whish: ${escapeHtml(phone)} · ${escapeHtml(nameAr)}</p>
</footer>`.trim();

  return {
    schoolName,
    studentCount: quote.students,
    curriculum: input.curriculum,
    titleAr,
    titleEn,
    bodyAr,
    bodyHtml,
    source: "template",
    quote,
    generatedAt: new Date().toISOString(),
  };
}

async function refineWithGemini(template: SchoolProposal): Promise<SchoolProposal | null> {
  const key = geminiApiKey();
  if (!key) return null;

  const models = process.env.GEMINI_MODEL?.trim()
    ? [process.env.GEMINI_MODEL.trim()]
    : ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"];

  const prompt = [
    `أنت كاتب عروض شراكة رسمية لأكاديمية MathMentor.`,
    `العلامة فقط: ${INSTRUCTOR_AR} / ${INSTRUCTOR_EN}. ممنوع تماماً ذكر «الطارة» أو Al-Tarah.`,
    `أعد صياغة العرض التالي بلغة عربية فصحى رسمية أوضح قليلاً، مع الإبقاء على كل الأرقام والخصومات وآلية Whish والميزات.`,
    `أعد JSON فقط بالمفاتيح: titleAr, bodyAr (نص متعدد الفقرات بفواصل سطر مزدوج).`,
    ``,
    `العنوان الحالي: ${template.titleAr}`,
    `النص:`,
    template.bodyAr,
  ].join("\n");

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) continue;
      const parsed = JSON.parse(text.slice(start, end + 1)) as { titleAr?: string; bodyAr?: string };
      if (!parsed.bodyAr || typeof parsed.bodyAr !== "string") continue;
      const titleAr =
        typeof parsed.titleAr === "string" && parsed.titleAr.trim()
          ? parsed.titleAr.trim()
          : template.titleAr;
      const bodyAr = parsed.bodyAr.trim();
      if (/الطارة|Al-Tarah/i.test(bodyAr) || /الطارة|Al-Tarah/i.test(titleAr)) continue;
      return {
        ...template,
        titleAr,
        bodyAr,
        bodyHtml: `
<header class="b2b-proposal-header">
  <p class="eyebrow">${escapeHtml(ACADEMY_LINE)}</p>
  <h1 dir="rtl" lang="ar">${escapeHtml(titleAr)}</h1>
  <p class="muted" dir="ltr">${escapeHtml(template.titleEn)}</p>
</header>
<article class="b2b-proposal-body" dir="rtl" lang="ar">
  ${paragraphsToHtml(bodyAr)}
</article>
<footer class="b2b-proposal-footer" dir="rtl" lang="ar">
  <p>التوقيع: ${escapeHtml(INSTRUCTOR_AR)} — ${escapeHtml(INSTRUCTOR_EN)}</p>
</footer>`.trim(),
        source: "gemini",
        generatedAt: new Date().toISOString(),
      };
    } catch {
      /* try next model */
    }
  }
  return null;
}

export async function generateSchoolProposal(input: ProposalInput): Promise<SchoolProposal> {
  const template = buildTemplateProposal(input);
  const refined = await refineWithGemini(template);
  return refined ?? template;
}
