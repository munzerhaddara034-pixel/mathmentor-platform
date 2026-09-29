import { academyLessons } from "@/lib/academyLessons";
import { monthlyLeaderboard, BADGE_META } from "@/lib/gamification/store";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const store = await readStore();
  const monthly = await monthlyLeaderboard();
  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">Gamification</p>
      <h1>لوحة الصدارة الشهرية</h1>
      <p className="muted">XP this month (Asia/Beirut) · lessons, solver, exams. Quiz attempts in store: {store.quizAttempts.length}.</p>
      <div className="grid two">
        {monthly.length === 0 ? <p>لا نتائج بعد. شاهد درساً أو حلّ مسألة.</p> : null}
        {monthly.map((row, index) => (
          <article className="card" key={row.userId}>
            <span className="badge">#{index + 1}</span>
            <h2>{row.name}</h2>
            <p>{row.xp} XP هذا الشهر</p>
            <p>🔥 {row.streakDays} أيام</p>
            <p className="muted">
              {row.badges.map((id) => BADGE_META[id]?.title).filter(Boolean).join(" · ") || "بدون أوسمة بعد"}
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
