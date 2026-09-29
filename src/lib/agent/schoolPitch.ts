/**
 * School outreach pitch — generate draft + dispatch after instructor approval.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره — never الطارة.
 * Never auto-send WhatsApp without approval gate.
 */
import { sendWhatsApp } from "@/lib/whatsapp/adapter";
import { INSTRUCTOR_AR } from "@/lib/pedagogy/lebanese";
import { parsePersuasionRegion } from "./schoolPersuasionEngine";

export interface SchoolLead {
  schoolName: string;
  principalPhone: string;
  principalName?: string;
  region: "Lebanon" | "GCC" | "International";
  curriculum: "Official" | "IB" | "American" | "British";
  studentCountEstimate?: number;
}

export const SCHOOL_OUTREACH_CONFIRM_AR =
  
  "🏫 تم إعداد المسودة التسويقية المقنعة لإدارة المدرسة وهي بانتظار اعتمادك قبل الإرسال على واتساب.";

/** Munzer bolt spec exact confirmation for code_evolution_request */
export const CODE_EVOLUTION_CONFIRM_AR =
  
  "💻 تلقى الوكيل المبرمج طلب التعديل، وسيقوم بإنشاء Commit في GitHub وإعادة البناء على Netlify فور اعتمادك.";

/** Munzer bolt spec schedule string — used where it fits secretary confirms */
export const SCHEDULE_MANAGEMENT_CONFIRM_AR =
  
  "🗓️ تم تسجيل الموعد في جدول الأعمال وسيقوم السكرتير بتنبيهك قبله عبر واتساب.";

export function regionFromRaw(raw: unknown): SchoolLead["region"] {
  const p = parsePersuasionRegion(raw);
  if (p === "gcc") return "GCC";
  if (p === "international") return "International";
  return "Lebanon";
}

export function curriculumFromRaw(raw: unknown): SchoolLead["curriculum"] {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s.includes("ib") || s.includes("البكالوريا الدولية")) return "IB";
  if (s.includes("american") || s.includes("sat") || s.includes("أمريك")) return "American";
  if (s.includes("british") || s.includes("cambridge") || s.includes("بريطان")) return "British";
  return "Official";
}

/** Best-effort lead extraction from voice/text + intent parameters. */
export function extractSchoolLead(
  transcript: string,
  params: Record<string, string | number | boolean | null> = {},
): SchoolLead {
  const schoolFromParam =
    typeof params.schoolName === "string" && params.schoolName.trim()
      ? params.schoolName.trim()
      : undefined;
  const schoolMatch =
    transcript.match(
      /(?:مدرس[ةه]|ثانوي[ةه]|school)\s+([^\n،,]{2,60}?)(?:\s+(?:و|على|في|بخصوص|راسل|تواصل)|$)/i,
    ) || transcript.match(/school\s+(?:named\s+)?([^\n,]{2,60})/i);
  const schoolName =
    schoolFromParam ||
    schoolMatch?.[1]?.trim().replace(/\s+/g, " ").slice(0, 80) ||
    "مدرسة شريكة";

  const phoneFromParam =
    typeof params.principalPhone === "string" && params.principalPhone.trim()
      ? params.principalPhone.trim()
      : typeof params.phone === "string"
        ? String(params.phone)
        : undefined;
  const phoneMatch = transcript.match(/(?:\+?961[\s-]?)?(?:0?7[\d\s-]{6,10}|\d{7,12})/);
  const principalPhone = (phoneFromParam || phoneMatch?.[0] || "")
    .replace(/[^\d+]/g, "")
    .slice(0, 20);

  const nameFromParam =
    typeof params.principalName === "string" ? params.principalName.trim() : undefined;
  const nameMatch = transcript.match(
    /(?:مدير|مديرة|الأستاذ|الأستاذة|الأستاذه)\s+([^\s،,]{2,40})/i,
  );
  const principalName = nameFromParam || nameMatch?.[1]?.trim();

  let studentCountEstimate: number | undefined;
  if (typeof params.studentCountEstimate === "number") {
    studentCountEstimate = params.studentCountEstimate;
  } else {
    const countMatch = transcript.match(/(\d{2,5})\s*(?:طالب|students?)/i);
    if (countMatch) studentCountEstimate = Number(countMatch[1]);
  }

  return {
    schoolName,
    principalPhone,
    principalName,
    region: regionFromRaw(params.region ?? transcript),
    curriculum: curriculumFromRaw(params.curriculum ?? transcript),
    studentCountEstimate,
  };
}

export function generateSchoolPitch(lead: SchoolLead): string {
  const greeting = lead.principalName
    ? `حضرة الأستاذ(ة) ${lead.principalName} المحترم/ة`
    : `حضرة إدارة ${lead.schoolName} الكريمة`;

  if (lead.region === "Lebanon") {
    return [
      `تحية طيبة، ${greeting}،`,
      `نتواصل معكم من منصة Math Mentor بإشراف ${INSTRUCTOR_AR}.`,
      "",
      `ندرك دقة امتحانات الشهادة الرسمية وأهمية تفادي هدر علامات طلاب الـ Terminale والـ Brevet على تفاصيل الـ Barème (المقاربات، الشرح التبريري، وصياغة الدوال).`,
      "",
      `🎯 كيف تساعد منصتنا مدرستكم هذا العام؟`,
      `1. مساعد سقراطي ذكي مدرب حصراً على سلم التصحيح اللبناني وتنسيق الرموز المعتمد.`,
      `2. توفير ما يزيد عن 12 ساعة تصحيح أسبوعياً لأساتذة الرياضيات لديكم عبر التصحيح الآلي للواجبات.`,
      `3. تقارير تشخيصية تفصيلية للإدارة حول الثغرات الرياضية لدى كل طالب قبل الامتحانات المدرسية.`,
      "",
      `يسرنا تزويد ثانويتكم بحساب تجريبي مجاني لأساتذة القسم لاختبار المنصة ميدانياً.`,
      `لترتيب جلسة عرض سريعة (15 دقيقة): نرجو الرد على هذه الرسالة.`,
      "",
      `${INSTRUCTOR_AR} · إدارة Math Mentor`,
    ].join("\n");
  }

  return [
    `السلام عليكم ورحمة الله، ${greeting}،`,
    `نتشرف بالتواصل معكم من منصة Math Mentor للتعليم الرياضي التفاعلي.`,
    `صممنا حلاً أكاديمياً متكاملاً لطلاب المسارات، اختبارات القدرات والتحصيلي، وبرامج (IB / AP / Cambridge) يجمع بين المحرك الرياضي الذكي والتقارير الوزارية التفصيلية.`,
    `يسعدنا تقديم عرض تجريبي متكامل للقسم الأكاديمي لديكم لتفعيل الشراكة.`,
    "",
    `إدارة Math Mentor الشركاء الأكاديميون`,
  ].join("\n");
}

/**
 * Send pitch via existing WhatsApp adapter.
 * Spec used kind "school_outreach" — we register that kind on WhatsAppKind.
 * Treats status "sent" OR "logged" (demo/outbox) as success so approval deploy works offline.
 */
export async function dispatchSchoolPitch(
  lead: SchoolLead,
): Promise<{ ok: boolean; error?: string; status?: string }> {
  if (!lead.principalPhone.trim()) {
    return { ok: false, error: "رقم هاتف المدير (principalPhone) مطلوب قبل الإرسال." };
  }
  const pitchText = generateSchoolPitch(lead);
  try {
    const res = await sendWhatsApp({
      to: lead.principalPhone,
      kind: "school_outreach",
      body: pitchText,
      relatedId: `school-pitch:${lead.schoolName.slice(0, 40)}`,
    });
    const ok = res.status === "sent" || res.status === "logged";
    return { ok, status: res.status, error: ok ? undefined : res.error || `whatsapp ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "فشل إرسال رسالة العرض للمدرسة",
    };
  }
}

/** Extract a code-change draft from transcript (approval required — no auto-commit). */
export function extractCodeChangeDraft(
  transcript: string,
  params: Record<string, string | number | boolean | null> = {},
): {
  filePath: string;
  commitMessage: string;
  newContent: string;
  summaryAr: string;
} {
  const fileFromParam =
    typeof params.filePath === "string" && params.filePath.trim()
      ? params.filePath.trim()
      : undefined;
  const pathMatch =
    transcript.match(
      /(?:(?:ملف|file|path)\s*[:：]?\s*)((?:src\/|app\/|lib\/|docs\/)[\w./\-]+)/i,
    ) || transcript.match(/((?:src|app|lib|docs)\/[\w./\-]+\.\w{1,8})/i);
  const filePath =
    fileFromParam || pathMatch?.[1] || "src/lib/agent/pending-evolution.md";

  const msgFromParam =
    typeof params.commitMessage === "string" && params.commitMessage.trim()
      ? params.commitMessage.trim()
      : undefined;
  const commitMessage = (
    msgFromParam ||
    transcript.replace(/\s+/g, " ").trim().slice(0, 180) ||
    "agent code evolution request"
  ).slice(0, 200);

  const contentFromParam =
    typeof params.newContent === "string" ? params.newContent : undefined;
  const fence = transcript.match(/```[\w]*\n([\s\S]+?)```/);
  const newContent =
    contentFromParam ||
    fence?.[1] ||
    [
      `# Agent code-evolution draft`,
      ``,
      `Request (Arabic/EN):`,
      transcript.slice(0, 2000),
      ``,
      `— Generated for instructor approval. Replace with real patch before commit if needed.`,
      `Brand: ${INSTRUCTOR_AR}`,
    ].join("\n");

  return {
    filePath,
    commitMessage,
    newContent,
    summaryAr: `تعديل مقترح → \`${filePath}\`\nالرسالة: ${commitMessage}`,
  };
}
