import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { userHasAiAccess } from "@/lib/auth/store";
import { gradePaper } from "@/lib/exams/grader";
import { paperById, papersForTrack, TRACK_LABELS } from "@/lib/exams/papers";
import type { ExamTrack } from "@/lib/exams/types";
import { listExamAttempts, saveExamAttempt } from "@/lib/exams/store";
import { FORMULA_SHEETS } from "@/lib/exams/formulas";
import { recordActivity } from "@/lib/gamification/store";
import { notifyStaff, pushNotification } from "@/lib/notifications/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const url = new URL(request.url);
  const paperId = url.searchParams.get("paper");
  const track = url.searchParams.get("track") as ExamTrack | null;
  if (paperId) {
    const paper = paperById(paperId);
    if (!paper) return NextResponse.json({ error: "Paper not found." }, { status: 404 });
    return NextResponse.json({ paper, formulas: FORMULA_SHEETS });
  }
  const attempts = isStaffRole(guard.live.user.role)
    ? await listExamAttempts()
    : await listExamAttempts({ userId: guard.live.user.id });
  return NextResponse.json({
    papers: (track ? papersForTrack(track) : papersForTrack()).map((paper) => ({
      id: paper.id,
      track: paper.track,
      title: paper.title,
      titleAr: paper.titleAr,
      sessionLabel: paper.sessionLabel,
      durationMinutes: paper.durationMinutes,
      totalMarks: paper.totalMarks,
    })),
    tracks: TRACK_LABELS,
    formulas: FORMULA_SHEETS,
    attempts: attempts.slice(0, 40),
  });
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;
  if (!isStaffRole(user.role) && !(await userHasAiAccess(user))) {
    return NextResponse.json({ error: "AI access required.", errorAr: "يلزم اشتراك الذكاء." }, { status: 403 });
  }
  const body = (await request.json()) as {
    paperId?: string;
    answers?: Record<string, string>;
    elapsedSec?: number;
  };
  const paper = paperById(body.paperId ?? "");
  if (!paper) return NextResponse.json({ error: "Unknown paper." }, { status: 400 });
  const answers = body.answers ?? {};
  const grading = await gradePaper(paper, answers);
  const attempt = await saveExamAttempt({
    paperId: paper.id,
    userId: user.id,
    studentName: user.name,
    studentPhone: user.phone,
    answers,
    grading,
    elapsedSec: body.elapsedSec ?? 0,
  });
  await recordActivity({
    userId: user.id,
    name: user.name,
    kind: "exam",
    examPercent: grading.percent,
    examTrack: paper.track,
    topic: paper.track.includes("brevet") ? "brevet" : "calculus",
  });
  await notifyStaff({
    kind: "exam_submitted",
    title: `${user.name} submitted ${paper.title}`,
    titleAr: `${user.name} سلّم ${paper.titleAr}`,
    body: `Score ${grading.totalAwarded}/${grading.totalMax} (${grading.percent}%).`,
    bodyAr: `العلامة ${grading.totalAwarded}/${grading.totalMax} (${grading.percent}%).`,
    href: "/admin/exams",
    relatedId: attempt.id,
  });
  await pushNotification({
    userId: user.id,
    audience: "student",
    kind: "exam_submitted",
    title: "Exam graded — download the barème PDF",
    titleAr: "تم التصحيح — نزّل تقرير السلّم",
    body: `${paper.title}: ${grading.totalAwarded}/${grading.totalMax}.`,
    bodyAr: `${paper.titleAr}: ${grading.totalAwarded}/${grading.totalMax}.`,
    href: `/api/exams/attempts/${attempt.id}/report`,
    relatedId: `self-${attempt.id}`,
  });
  return NextResponse.json({
    ok: true,
    attempt,
    reportUrl: `/api/exams/attempts/${attempt.id}/report`,
  });
}
