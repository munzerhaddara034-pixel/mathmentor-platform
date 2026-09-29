import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { generateSchoolProposal, type ProposalCurriculum } from "@/lib/b2b/proposal";

export const runtime = "nodejs";

const bodySchema = z.object({
  schoolName: z.string().min(1).max(200),
  studentCount: z.coerce.number().int().min(1).max(5000),
  curriculum: z.enum(["Lebanese", "International"]),
});

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Staff only.", errorAr: "للطاقم فقط." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON.", errorAr: "طلب غير صالح." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "schoolName, studentCount, and curriculum (Lebanese|International) required.",
        errorAr: "يلزم اسم المدرسة وعدد الطلاب والمنهج (لبناني|دولي).",
      },
      { status: 400 },
    );
  }

  const proposal = await generateSchoolProposal({
    schoolName: parsed.data.schoolName,
    studentCount: parsed.data.studentCount,
    curriculum: parsed.data.curriculum as ProposalCurriculum,
  });

  return NextResponse.json({ ok: true, proposal });
}
