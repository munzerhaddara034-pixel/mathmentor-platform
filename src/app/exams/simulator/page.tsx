import { ExamSimulator } from "@/components/exams/ExamSimulator";
import { getLiveSession } from "@/lib/auth/session";
import { paperById, OFFICIAL_PAPERS } from "@/lib/exams/papers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { practiceMessages } from "@/lib/i18n/ns/practice";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const ALL_PAPERS = { en: "All papers", ar: "كل الأوراق", fr: "Toutes les épreuves" } as const;

export default async function ExamSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ paper?: string; track?: string }>;
}) {
  const { paper: paperId, track } = await searchParams;
  const paper = paperId ? paperById(paperId) : OFFICIAL_PAPERS.find((item) => !track || item.track === track) ?? OFFICIAL_PAPERS[0];
  if (!paper) notFound();
  const live = await getLiveSession();
  const { locale } = await getI18n();
  const student = live.ok
    ? { name: live.user.name, phone: live.user.phone }
    : { name: practiceMessages[locale].take.defaultName, phone: "" };

  return (
    <main className="shell">
      <p className="muted">
        <Link href="/exams">{locale === "ar" ? "→" : "←"} {ALL_PAPERS[locale]}</Link>
      </p>
      <ExamSimulator paper={paper} student={student} />
    </main>
  );
}
