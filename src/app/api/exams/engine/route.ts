import { assembleBankExam, assembleExam, listExamPacks, type CertificateBranch, type ExamPackMeta } from "@/lib/examCatalog";
import type { SessionKind } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const packId = url.searchParams.get("pack") ?? "";
  const bankId = url.searchParams.get("bank") ?? "";
  const mode = url.searchParams.get("mode") === "free" ? "free" : "contest";
  const certificate = (url.searchParams.get("certificate") ?? "") as CertificateBranch | "";
  const year = url.searchParams.get("year") ?? "";
  const session = (url.searchParams.get("session") ?? "") as SessionKind | "";
  const topic = url.searchParams.get("topic") ?? "";
  const list = url.searchParams.get("list") === "1";

  if (list) {
    const packs = listExamPacks({
      certificate: certificate || undefined,
      year: year ? Number(year) : undefined,
      session: session || undefined,
      topic: topic || undefined,
    });
    return NextResponse.json({ packs });
  }

  if (packId) {
    const assembled = assembleExam(packId);
    if (!assembled) return NextResponse.json({ error: "النموذج غير موجود" }, { status: 404 });
    return NextResponse.json(assembled);
  }

  if (bankId) {
    const assembled = assembleBankExam(bankId, mode);
    if (!assembled) return NextResponse.json({ error: "البنك غير موجود" }, { status: 404 });
    return NextResponse.json(assembled);
  }

  const packs: ExamPackMeta[] = listExamPacks({
    certificate: certificate || undefined,
    year: year ? Number(year) : undefined,
    session: session || undefined,
    topic: topic || undefined,
  });
  return NextResponse.json({ packs });
}
