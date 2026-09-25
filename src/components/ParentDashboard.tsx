import Link from "next/link";
import type { RoleDashboard } from "@/lib/auth/dashboard";
import { roleLabel } from "@/lib/auth/types";

export function ParentDashboard({ data }: { data: RoleDashboard }) {
  const student = data.linkedStudent;
  return (
    <main className="shell">
      <p className="eyebrow">لوحة ولي الأمر</p>
      <div className="dash-hero">
        <div>
          <h1>أهلاً {data.user.name}</h1>
          <p className="muted">
            {student
              ? `متابعة تقدم ${student.name} في Math Mentor — دروس الأستاذ منذر حدارة ومواعيد الامتحانات.`
              : "اربط بريد الطالب من صفحة الملف لمتابعة التقدم."}
          </p>
        </div>
        <span className="role-badge large">{roleLabel(data.user.role)}</span>
      </div>
      {student ? (
        <p className="welcome-banner">
          الطالب المرتبط: <strong>{student.name}</strong> · {student.email}
        </p>
      ) : null}
      <section className="grid two dash-section">
        <article className="card">
          <h2>تقدم الدورات</h2>
          {data.courses.map((course) => (
            <div key={course.id} className="progress-block">
              <div className="progress-head">
                <strong>{course.arabicTitle}</strong>
                <span>{course.percent}%</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${course.percent}%` }} />
              </div>
            </div>
          ))}
        </article>
        <article className="card">
          <h2>مواعيد قادمة</h2>
          <ul className="reminder-list">
            {data.reminders.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.arabicTitle}</strong>
                  <p className="muted">بعد {item.daysLeft} يوم</p>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <div className="row">
        <Link className="btn dark" href="/profile">
          الملف الشخصي
        </Link>
        <Link className="ghost-btn ink" href="/classroom">
          تصفح الصف
        </Link>
      </div>
    </main>
  );
}
