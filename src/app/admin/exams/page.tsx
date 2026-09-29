import { requireStaff } from "@/lib/auth/guards";
import { listExamAttempts, listGeneratedSets } from "@/lib/exams/store";
import { paperById } from "@/lib/exams/papers";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatBeirut(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Beirut",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

export default async function AdminExamsPage() {
  await requireStaff("/admin/exams");
  const attempts = await listExamAttempts();
  const generated = await listGeneratedSets();
  return (
    <main className="shell" dir="ltr">
      <p className="eyebrow">Teacher review</p>
      <h1>Exam simulations submitted</h1>
      <p className="muted">
        <Link href="/dashboard">Dashboard</Link> · <Link href="/exams">Simulator hub</Link> ·{" "}
        <Link href="/exams?track=sat">SAT Math papers</Link>
      </p>
      <p className="muted">
        Studio note: SAT <strong>Generate similar</strong> and <strong>generate-from-official</strong> (
        <code>official-sat-style-N</code>) sets are listed below. Original content only — College Board PDFs are
        linked externally; we never store CB exam item text.
      </p>

      <h2>Submitted attempts</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Paper</th>
            <th>Score</th>
            <th>When (Asia/Beirut)</th>
            <th>PDF</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <tr key={attempt.id}>
              <td>
                {attempt.studentName}
                <br />
                <span className="muted">{attempt.studentPhone}</span>
              </td>
              <td>{paperById(attempt.paperId)?.title ?? attempt.paperId}</td>
              <td>
                {attempt.grading.totalAwarded}/{attempt.grading.totalMax} ({attempt.grading.percent}%)
              </td>
              <td>{formatBeirut(attempt.createdAt)}</td>
              <td>
                <a href={`/api/exams/attempts/${attempt.id}/report`}>PDF</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Generated similar sets (على نسقه)</h2>
      {generated.length === 0 ? (
        <p className="muted">No generated sets yet. Students generate from the SAT simulator.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Set</th>
              <th>Paper</th>
              <th>Source Q</th>
              <th>Items</th>
              <th>Engine</th>
              <th>When (Asia/Beirut)</th>
            </tr>
          </thead>
          <tbody>
            {generated.slice(0, 60).map((set) => (
              <tr key={set.id}>
                <td>
                  <code>{set.id}</code>
                  <br />
                  <span className="muted">user {set.userId}</span>
                </td>
                <td>{paperById(set.paperId)?.title ?? set.paperId}</td>
                <td>{set.sourceQuestionId ?? "— (whole paper)"}</td>
                <td>{set.questions.length}</td>
                <td>{set.source}</td>
                <td>{formatBeirut(set.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
