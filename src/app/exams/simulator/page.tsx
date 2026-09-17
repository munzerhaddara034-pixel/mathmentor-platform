import { ExamSimulator } from "@/components/exams/ExamSimulator";
import { getLiveSession } from "@/lib/auth/session";
import { paperById, OFFICIAL_PAPERS } from "@/lib/exams/papers";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExamSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ paper?: string; track?: string }>;
}) {
  const { paper: paperId, track } = await searchParams;
  const paper = paperId ? paperById(paperId) : OFFICIAL_PAPERS.find((item) => !track || item.track === track) ?? OFFICIAL_PAPERS[0];
  if (!paper) notFound();
  const live = await getLiveSession();
  const student = live.ok
    ? { name: live.user.name, phone: live.user.phone }
    : { name: "Sara Nassar", phone: "76111111" };

  return (
    <main className="shell">
      <p className="muted">
        <Link href="/exams">← All papers</Link>
      </p>
      <ExamSimulator paper={paper} student={student} />
    </main>
  );
}
