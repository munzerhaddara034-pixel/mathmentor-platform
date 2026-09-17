import { requireStaff } from "@/lib/auth/guards";
import { listExamAttempts } from "@/lib/exams/store";
import { paperById } from "@/lib/exams/papers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminExamsPage() {
  await requireStaff("/admin/exams");
  const attempts = await listExamAttempts();
  return (
    <main className="shell" dir="ltr">
      <p className="eyebrow">Teacher review</p>
      <h1>Exam simulations submitted</h1>
      <p className="muted">
        <Link href="/dashboard">Dashboard</Link> · <Link href="/exams">Simulator</Link>
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Paper</th>
            <th>Score</th>
            <th>When</th>
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
              <td>{attempt.createdAt.slice(0, 16).replace("T", " ")}</td>
              <td>
                <a href={`/api/exams/attempts/${attempt.id}/report`}>PDF</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
