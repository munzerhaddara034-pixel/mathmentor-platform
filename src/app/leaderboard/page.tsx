import { academyLessons } from "@/lib/academyLessons";
import { badgesFor } from "@/lib/gating";
import { readStore } from "@/lib/store";

export default async function LeaderboardPage() {
  const store = await readStore();
  const scores = new Map<string, number>();
  for (const attempt of store.quizAttempts) {
    scores.set(attempt.studentName, (scores.get(attempt.studentName) ?? 0) + attempt.points);
  }
  const rows = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">Gamification</p>
      <h1>لوحة الصدارة والأوسمة</h1>
      <p className="muted">{store.quizAttempts.length} محاولة اختبار · نقاط من الدرجات.</p>
      <div className="grid two">
        {rows.length === 0 ? <p>لا نتائج بعد. أنه اختبار درس لتظهر هنا.</p> : null}
        {rows.map(([name, points], index) => (
          <article className="card" key={name}>
            <span className="badge">#{index + 1}</span>
            <h2>{name}</h2>
            <p>{points} نقطة</p>
            <p className="muted">
              {badgesFor(name, store.quizAttempts)
                .map((badge) => badge.title)
                .join(" · ") || "ابدأ اختباراً لنيل وسام"}
            </p>
          </article>
        ))}
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>الدروس المرتبطة</h2>
        <p className="muted">{academyLessons.length} درساً في المنصة.</p>
      </section>
    </main>
  );
}
