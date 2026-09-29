import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { userHasAiAccess } from "@/lib/auth/store";
import { generateFromOfficial } from "@/lib/exams/generateSimilar";
import type { OfficialSatDomainId, OfficialSatTestNumber } from "@/lib/exams/officialSatBlueprint";
import { saveGeneratedSet } from "@/lib/exams/store";

export const runtime = "nodejs";

const ALLOWED_TESTS: OfficialSatTestNumber[] = [5, 10, 11];
const ALLOWED_DOMAINS: OfficialSatDomainId[] = [
  "algebra",
  "advanced-math",
  "problem-solving-data",
  "geometry-trigonometry",
];

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;
  if (!isStaffRole(user.role) && !(await userHasAiAccess(user))) {
    return NextResponse.json(
      { error: "AI access required.", errorAr: "يلزم اشتراك الذكاء." },
      { status: 403 },
    );
  }

  let body: {
    officialTest?: number;
    skill?: string;
    count?: number;
    module?: number;
    domain?: string;
    skillNote?: string;
    save?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const officialTest = body.officialTest as OfficialSatTestNumber | undefined;
  if (!officialTest || !ALLOWED_TESTS.includes(officialTest)) {
    return NextResponse.json(
      { error: "officialTest must be 5, 10, or 11.", errorAr: "رقم النموذج الرسمي: 5 أو 10 أو 11." },
      { status: 400 },
    );
  }

  const module =
    body.module === 1 || body.module === 2 ? (body.module as 1 | 2) : undefined;
  const domain =
    body.domain && ALLOWED_DOMAINS.includes(body.domain as OfficialSatDomainId)
      ? (body.domain as OfficialSatDomainId)
      : undefined;

  try {
    const { set, tag } = await generateFromOfficial({
      officialTest,
      skill: body.skill?.trim() || undefined,
      count: body.count,
      module,
      domain,
      skillNote: body.skillNote?.trim() || undefined,
      userId: user.id,
    });
    if (body.save !== false) {
      await saveGeneratedSet(set);
    }
    return NextResponse.json({
      ok: true,
      set,
      tag,
      officialTest,
      note:
        set.source === "demo"
          ? "Original official-style variants from public Digital SAT blueprint (no CB text)."
          : "LLM original items tagged official-sat-style (no CB text).",
      noteAr:
        set.source === "demo"
          ? "أسئلة أصلية على نسق Digital SAT الرسمي (بدون نسخ نص College Board)."
          : "أسئلة أصلية بالذكاء الاصطناعي على نسق النموذج الرسمي.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
