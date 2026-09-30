import { requireStaff } from "@/lib/auth/guards";
import { listExamAttempts, listGeneratedSets } from "@/lib/exams/store";
import { paperById } from "@/lib/exams/papers";
import Link from "next/link";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { adminToolsMessages } from "@/lib/i18n/ns/adminTools";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function formatBeirut(iso: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
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
  const { locale } = await getI18n();
  const t = adminToolsMessages[locale].exams;
  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">
        <Link href="/dashboard">{t.dashboard}</Link> · <Link href="/exams">{t.hub}</Link> ·{" "}
        <Link href="/exams?track=sat">{t.sat}</Link>
      </p>
      <p className="muted">
        {rich(t.note, {
          similar: <strong>{t.similar}</strong>,
          official: <strong>{t.official}</strong>,
          code: <code dir="ltr">official-sat-style-N</code>,
        })}
      </p>

      <h2>{t.attempts}</h2>
      {attempts.length === 0 ? <p className="muted">{t.noAttempts}</p> : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>{t.student}</th>
            <th>{t.paper}</th>
            <th>{t.score}</th>
            <th>{t.when}</th>
            <th>{t.pdf}</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <tr key={attempt.id}>
              <td>
                {attempt.studentName}
                <br />
                <span className="muted" dir="ltr">
                  {attempt.studentPhone}
                </span>
              </td>
              <td>{paperById(attempt.paperId)?.title ?? attempt.paperId}</td>
              <td>
                {attempt.grading.totalAwarded}/{attempt.grading.totalMax} ({attempt.grading.percent}%)
              </td>
              <td>{formatBeirut(attempt.createdAt, locale)}</td>
              <td>
                <a href={`/api/exams/attempts/${attempt.id}/report`}>{t.pdf}</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>{t.generated}</h2>
      {generated.length === 0 ? (
        <p className="muted">{t.noGenerated}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.set}</th>
              <th>{t.paper}</th>
              <th>{t.sourceQ}</th>
              <th>{t.items}</th>
              <th>{t.engine}</th>
              <th>{t.when}</th>
            </tr>
          </thead>
          <tbody>
            {generated.slice(0, 60).map((set) => (
              <tr key={set.id}>
                <td>
                  <code>{set.id}</code>
                  <br />
                  <span className="muted">{fmt(t.user, { id: set.userId })}</span>
                </td>
                <td>{paperById(set.paperId)?.title ?? set.paperId}</td>
                <td>{set.sourceQuestionId ?? t.wholePaper}</td>
                <td>{set.questions.length}</td>
                <td>{set.source}</td>
                <td>{formatBeirut(set.createdAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
