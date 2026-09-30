import Link from "next/link";
import type { RoleDashboard } from "@/lib/auth/dashboard";
import { fmt } from "@/lib/i18n/format";
import { accountMessages } from "@/lib/i18n/ns/account";
import { pickTitle } from "@/lib/i18n/pick";
import { getI18n } from "@/lib/i18n/server";

export async function ParentDashboard({ data }: { data: RoleDashboard }) {
  const { locale, m } = await getI18n();
  const t = accountMessages[locale].parent;
  const student = data.linkedStudent;
  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <div className="dash-hero">
        <div>
          <h1>{fmt(t.hello, { name: data.user.name })}</h1>
          <p className="muted">{student ? fmt(t.following, { student: student.name }) : t.linkHint}</p>
        </div>
        <span className="role-badge large">{m.auth.roles[data.user.role]}</span>
      </div>
      {student ? (
        <p className="welcome-banner">
          {t.linkedStudent} <strong>{student.name}</strong> · <bdi>{student.email}</bdi>
        </p>
      ) : null}
      <section className="grid two dash-section">
        <article className="card">
          <h2>{t.courses}</h2>
          {data.courses.map((course) => (
            <div key={course.id} className="progress-block">
              <div className="progress-head">
                <strong>{pickTitle(locale, course)}</strong>
                <span>{course.percent}%</span>
              </div>
              <div className="progress-track">
                <span style={{ inlineSize: `${course.percent}%` }} />
              </div>
            </div>
          ))}
        </article>
        <article className="card">
          <h2>{t.upcoming}</h2>
          <ul className="reminder-list">
            {data.reminders.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{pickTitle(locale, item)}</strong>
                  <p className="muted">{fmt(t.inDays, { n: item.daysLeft })}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <div className="row">
        <Link className="btn dark" href="/profile">
          {t.profile}
        </Link>
        <Link className="ghost-btn ink" href="/classroom">
          {t.classroom}
        </Link>
      </div>
    </main>
  );
}
