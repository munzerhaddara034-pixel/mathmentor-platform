import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { getExamAttempt } from "@/lib/exams/store";
import { paperById } from "@/lib/exams/papers";
import { buildSimplePdf, examReportLines } from "@/lib/exams/pdf";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const { id } = await context.params;
  const attempt = await getExamAttempt(id);
  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (!isStaffRole(guard.live.user.role) && attempt.userId !== guard.live.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const paper = paperById(attempt.paperId);
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "pdf";
  const title = paper?.title ?? attempt.paperId;
  const lines = examReportLines({
    studentName: attempt.studentName,
    studentPhone: attempt.studentPhone,
    paperTitle: title,
    track: paper?.track ?? "",
    createdAt: attempt.createdAt,
    grading: attempt.grading,
  });
  if (format === "html") {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Georgia,serif;max-width:720px;margin:32px auto;color:#10213d}h1{color:#10213d}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #dfe7f1;padding:8px;text-align:left}</style>
      </head><body>
      <p>MathMentor · أكاديمية منذر حداره · Prof. Munzer Haddara</p>
      <h1>Barème report</h1>
      <p>${attempt.studentName} · ${attempt.studentPhone}</p>
      <p><strong>${attempt.grading.totalAwarded} / ${attempt.grading.totalMax}</strong> (${attempt.grading.percent}%)</p>
      <table><thead><tr><th>Item</th><th>Marks</th><th>Comment</th></tr></thead><tbody>
      ${attempt.grading.subs.map((sub) => `<tr><td>${sub.label}</td><td>${sub.awarded}/${sub.max}</td><td>${sub.comment}</td></tr>`).join("")}
      </tbody></table></body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const pdf = buildSimplePdf("MathMentor exam report", lines);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mathmentor-${attempt.paperId}-bareme.pdf"`,
    },
  });
}
