import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import { generateParentDigest, generateSchoolReport } from "@/lib/agent/reports";
import { stageSchoolReport } from "@/lib/agent/approvalWorkflow";
import { notifyInstructorHubCompletion } from "@/lib/agent/whatsappSender";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["school", "parent"]).default("school"),
  schoolName: z.string().optional(),
  periodLabel: z.string().optional(),
  partnerCode: z.string().optional(),
  studentName: z.string().optional(),
  parentPhone: z.string().optional(),
  weekLabel: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.kind === "parent") {
      const digest = await generateParentDigest({
        studentName: parsed.data.studentName,
        parentPhone: parsed.data.parentPhone,
        weekLabel: parsed.data.weekLabel,
      });
      const wa = await notifyInstructorHubCompletion({
        intentKind: "general_task",
        status: "completed",
        transcript: `Agent Hub · ملخّص أهل: ${digest.studentName}`,
        parentDigest: digest,
        relatedIds: [digest.id],
      });
      return NextResponse.json({
        ok: true,
        auth: auth.mode,
        kind: "parent",
        digest,
        whatsappAr: digest.whatsapp.bodyAr,
        outboundWhatsApp: wa.outbound,
        instructorWhatsappReply: wa.replyAr,
        task: wa.task,
      });
    }

    const report = await generateSchoolReport({
      schoolName: parsed.data.schoolName,
      periodLabel: parsed.data.periodLabel,
      partnerCode: parsed.data.partnerCode,
    });
    const staged = await stageSchoolReport(report);
    const wa = await notifyInstructorHubCompletion({
      intentKind: "school_report",
      status: "queued",
      transcript: `Agent Hub · تقرير بانتظار الموافقة: ${report.schoolName}`,
      schoolReport: report,
      relatedIds: [report.id, staged.item.id],
    });
    return NextResponse.json({
      ok: true,
      auth: auth.mode,
      kind: "school",
      stagedApproval: staged.item,
      report,
      pdfHtml: report.pdf.html,
      textSummary: report.pdf.textSummary,
      whish: {
        phone: report.whishWalletPhone,
        nameAr: report.whishWalletNameAr,
      },
      outboundWhatsApp: wa.outbound,
      whatsappReply: wa.replyAr,
      task: wa.task,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "generate-report failed",
      },
      { status: 500 },
    );
  }
}
