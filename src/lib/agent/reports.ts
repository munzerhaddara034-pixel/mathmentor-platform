/**
 * School B2B reports + empathetic Arabic parent WhatsApp digests.
 */

import { createId } from "@/lib/ids";
import { INSTRUCTOR_AR, INSTRUCTOR_EN, ACADEMY_LINE } from "@/lib/pedagogy/lebanese";
import { whishTransferNameAr, whishTransferPhone } from "@/lib/whish/client";
import { saveParentDigest, saveSchoolReport } from "./store";
import type {
  BaremeMistakeTrend,
  ParentDigest,
  SchoolReport,
  StudentProgressRow,
} from "./types";

const DEFAULT_TRENDS: BaremeMistakeTrend[] = [
  {
    topic: "Limits at infinity",
    topicAr: "النهايات عند اللانهاية",
    baremeCode: "limits",
    count: 14,
    ratePct: 28,
  },
  {
    topic: "Horizontal asymptotes",
    topicAr: "المقاربات الأفقية",
    baremeCode: "asymptotes",
    count: 11,
    ratePct: 22,
  },
  {
    topic: "Derivative / product rule",
    topicAr: "المشتق / مشتق الجداء",
    baremeCode: "derivatives",
    count: 9,
    ratePct: 18,
  },
  {
    topic: "Domain justification",
    topicAr: "تبرير مجموعة التعريف",
    baremeCode: "domain",
    count: 7,
    ratePct: 14,
  },
];

const DEFAULT_STUDENTS: StudentProgressRow[] = [
  {
    studentId: "stu-demo-1",
    studentName: "Maya K.",
    gradeLabel: "Terminale LS",
    completionRate: 0.82,
    lastActiveAt: new Date().toISOString(),
    weakTopics: ["asymptotes", "variation table"],
  },
  {
    studentId: "stu-demo-2",
    studentName: "Karim H.",
    gradeLabel: "Terminale GS",
    completionRate: 0.61,
    lastActiveAt: new Date().toISOString(),
    weakTopics: ["limits", "derivatives"],
  },
  {
    studentId: "stu-demo-3",
    studentName: "Nour A.",
    gradeLabel: "Brevet",
    completionRate: 0.74,
    lastActiveAt: new Date().toISOString(),
    weakTopics: ["domain"],
  },
];

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function generateSchoolReport(input: {
  schoolName?: string;
  periodLabel?: string;
  partnerCode?: string;
}): Promise<SchoolReport> {
  try {
    const schoolName = input.schoolName?.trim() || "مدرسة الشريك التجريبية";
    const periodLabel = input.periodLabel?.trim() || "آخر ٣٠ يوماً";
    const students = DEFAULT_STUDENTS;
    const trends = DEFAULT_TRENDS;
    const completionRate =
      students.reduce((sum, s) => sum + s.completionRate, 0) / Math.max(1, students.length);

    const titleAr = `تقرير تقدّم مدرسي — ${schoolName}`;
    const titleEn = `School progress report — ${schoolName}`;
    const textSummary = [
      `${titleEn} · ${periodLabel}`,
      `Completion: ${Math.round(completionRate * 100)}%`,
      `Top Barème pitfalls: ${trends.map((t) => t.topic).join(", ")}`,
      `Instructor: ${INSTRUCTOR_EN} / ${INSTRUCTOR_AR}`,
      `Whish: ${whishTransferPhone()} · ${whishTransferNameAr()}`,
    ].join("\n");

    const html = `
<article class="agent-school-report" dir="rtl" lang="ar">
  <header>
    <p class="eyebrow">${escapeHtml(ACADEMY_LINE)}</p>
    <h1>${escapeHtml(titleAr)}</h1>
    <p class="muted" dir="ltr">${escapeHtml(titleEn)} · ${escapeHtml(periodLabel)}</p>
  </header>
  <section>
    <h2>نسبة الإنجاز</h2>
    <p><strong>${Math.round(completionRate * 100)}%</strong> عبر ${students.length} طلاب عيّنة.</p>
  </section>
  <section>
    <h2>اتجاهات أخطاء الباريم اللبناني</h2>
    <ul>
      ${trends
        .map(
          (t) =>
            `<li><strong>${escapeHtml(t.topicAr)}</strong> (${escapeHtml(t.baremeCode)}) — ${t.count} · ${t.ratePct}%</li>`,
        )
        .join("\n")}
    </ul>
    <p class="muted">ملاحظات: النهايات، المقاربات، والمشتقات — أهم خسائر العلامات في الامتحان الرسمي.</p>
  </section>
  <section>
    <h2>تقدّم الطلاب</h2>
    <ul>
      ${students
        .map(
          (s) =>
            `<li>${escapeHtml(s.studentName)} · ${escapeHtml(s.gradeLabel)} · ${Math.round(s.completionRate * 100)}%</li>`,
        )
        .join("\n")}
    </ul>
  </section>
  <footer>
    <p>${escapeHtml(INSTRUCTOR_AR)} — ${escapeHtml(INSTRUCTOR_EN)}</p>
    <p>Whish: ${escapeHtml(whishTransferPhone())} باسم ${escapeHtml(whishTransferNameAr())}</p>
  </footer>
</article>`.trim();

    const report: SchoolReport = {
      id: createId("schoolrpt"),
      schoolName,
      partnerCode: input.partnerCode?.trim() || undefined,
      periodLabel,
      studentProgress: students,
      baremeMistakeTrends: trends,
      completionRate,
      pdf: {
        titleAr,
        titleEn,
        html,
        textSummary,
        generatedAt: new Date().toISOString(),
      },
      whishWalletPhone: whishTransferPhone(),
      whishWalletNameAr: whishTransferNameAr(),
      createdAt: new Date().toISOString(),
      source: "mock",
    };
    return saveSchoolReport(report);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "school report failed");
  }
}

export async function generateParentDigest(input: {
  studentName?: string;
  parentPhone?: string;
  weekLabel?: string;
}): Promise<ParentDigest> {
  try {
    const studentName = input.studentName?.trim() || "الطالب";
    const weekLabel = input.weekLabel?.trim() || "هذا الأسبوع";
    const strongPoints = ["Consistent quiz practice", "Clear domain justifications"];
    const strongPointsAr = ["انتظام في التمارين القصيرة", "تبرير واضح لمجموعة التعريف"];
    const weakPoints = ["Limits at −∞ rewriting", "Product-rule derivative steps"];
    const weakPointsAr = ["إعادة صياغة النهايات عند −∞", "خطوات مشتق الجداء في الباريم"];

    const bodyAr = [
      `السلام عليكم،`,
      `ملخّص ${weekLabel} لـ ${studentName} من ${INSTRUCTOR_AR} (${ACADEMY_LINE}):`,
      `• نشاط: ٣ جلسات · ٤ اختبارات · ٤٥ دقيقة دراسة · حجز مباشر واحد.`,
      `• نقاط قوة: ${strongPointsAr.join("؛ ")}.`,
      `• للتحسين بلطف: ${weakPointsAr.join("؛ ")} — نراجعها معاً بخطوات الباريم.`,
      `أنتم لستم وحدكم؛ المنصّة ترافق ${studentName} بهدوء وثقة.`,
      `للاستفسار واتساب / Whish: ${whishTransferPhone()} باسم ${whishTransferNameAr()}.`,
    ].join("\n");

    const bodyEn = [
      `Hello,`,
      `${weekLabel} digest for ${studentName} from ${INSTRUCTOR_EN}:`,
      `• Activity: 3 sessions · 4 quizzes · 45 study minutes · 1 live booking.`,
      `• Strengths: ${strongPoints.join("; ")}.`,
      `• Gentle focus next: ${weakPoints.join("; ")}.`,
      `${ACADEMY_LINE}`,
    ].join("\n");

    const digest: ParentDigest = {
      id: createId("parentdig"),
      studentName,
      parentPhone: input.parentPhone?.trim() || undefined,
      weekLabel,
      weeklyActivity: {
        sessionsCompleted: 3,
        quizzesTaken: 4,
        minutesStudied: 45,
        liveBookings: 1,
      },
      strongPoints,
      strongPointsAr,
      weakPoints,
      weakPointsAr,
      whatsapp: {
        to: input.parentPhone?.trim() || undefined,
        bodyAr,
        bodyEn,
        kind: "parent_digest",
      },
      createdAt: new Date().toISOString(),
      source: "mock",
    };
    return saveParentDigest(digest);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "parent digest failed");
  }
}
