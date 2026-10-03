import Link from "next/link";
import type { RoleDashboard } from "@/lib/auth/dashboard";
import { roleLabel } from "@/lib/auth/types";

export function StudentDashboard({ data }: { data: RoleDashboard }) {
  const { user, courses, reminders } = data;
  return (
    <main className="shell">
      <p className="eyebrow">لوحة الطالب</p>
      <div className="dash-hero">
        <div>
          <h1>أهلاً {user.name}</h1>
          <p className="muted">تابع تقدمك في مسارات الشهادة، راقب مواعيد الامتحانات، وافتح صف الأستاذ منذر من هنا.</p>
        </div>
        <span className="role-badge large">{roleLabel(user.role)}</span>
      </div>

      <section className="grid two dash-section">
        <article className="card">
          <h2>تقدم الدورات</h2>
          {courses.length ? (
            courses.map((course) => (
              <div key={course.id} className="progress-block">
                <div className="progress-head">
                  <strong>{course.arabicTitle}</strong>
                  <span>{course.percent}%</span>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${course.percent}%` }} />
                </div>
                <p className="muted">{course.title}</p>
              </div>
            ))
          ) : (
            <p className="muted">لا دورات مسجّلة بعد. ابدأ من الصف أو الاختبارات.</p>
          )}
        </article>
        <article className="card">
          <h2>تذكير الامتحانات</h2>
          {reminders.length ? (
            <ul className="reminder-list">
              {reminders.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.arabicTitle}</strong>
                    <p className="muted">{item.title}</p>
                  </div>
                  <div className="reminder-meta">
                    <span className="badge">{item.daysLeft === 0 ? "اليوم" : `بعد ${item.daysLeft} يوم`}</span>
                    {item.href ? (
                      <Link href={item.href} className="ghost-link">
                        فتح
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">لا مواعيد قريبة حالياً.</p>
          )}
        </article>
      </section>

      <section className="dash-section">
        <h2>دوراتي المسجّلة</h2>
        <div className="grid two">
          {courses.map((course) => (
            <article className="card course-card" key={course.id}>
              <p className="eyebrow">{course.title}</p>
              <h3>{course.arabicTitle}</h3>
              <div className="progress-track">
                <span style={{ width: `${course.percent}%` }} />
              </div>
              <p className="muted">إنجاز {course.percent}% · دروس الصف والبنوك الرسمية للمنصة</p>
              <ul className="lesson-mini">
                {course.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={lesson.href}>{lesson.arabicTitle || lesson.title}</Link>
                    <span>{lesson.percent}%</span>
                  </li>
                ))}
              </ul>
              <div className="row">
                <Link className="btn dark" href={course.href}>
                  الصف
                </Link>
                <Link className="ghost-btn ink" href={course.practiceHref}>
                  تدريب / مسابقة
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
