import Link from "next/link";
import { opsMessages } from "@/lib/i18n/ns/ops";
import { getI18n } from "@/lib/i18n/server";
import { errorSummary, listOpsErrors } from "@/lib/ops/errorLog";
import "@/lib/ops/errorLogStore";

export const dynamic = "force-dynamic";

/** Staff view of the first-party error log (see src/lib/ops/errorLog.ts). */
export default async function AdminOpsPage() {
  const { locale } = await getI18n();
  const t = opsMessages[locale].pages;
  const [summary, errors] = await Promise.all([errorSummary(), listOpsErrors(40)]);
  return (
    <main className="shell">
      <p className="eyebrow">{t.opsEyebrow}</p>
      <h1>{t.opsTitle}</h1>
      <p className="muted">
        {t.opsLead} <Link href="/admin">{t.backToAdmin}</Link>
      </p>
      <ul className="stat-row">
        <li>
          <strong>{summary.total}</strong> {t.opsTotal}
        </li>
        <li>
          <strong>{summary.last24h}</strong> {t.opsLast24}
        </li>
        <li>
          <strong>{summary.last7d}</strong> {t.opsLast7}
        </li>
        <li>
          <strong>{summary.entries}</strong> {t.opsRows}
        </li>
      </ul>
      {errors.length === 0 ? (
        <p className="muted">{t.opsEmpty}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t.opsSource}</th>
              <th scope="col">{t.opsRoute}</th>
              <th scope="col">{t.opsMessage}</th>
              <th scope="col">{t.opsCount}</th>
              <th scope="col">{t.opsLastSeen}</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.source}</td>
                <td>{entry.route || "—"}</td>
                <td>{entry.message}</td>
                <td>{entry.count}</td>
                <td>{entry.lastAt.slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}