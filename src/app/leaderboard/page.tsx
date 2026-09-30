import { academyLessons } from "@/lib/academyLessons";
import { monthlyLeaderboard } from "@/lib/gamification/store";
import { fmt } from "@/lib/i18n/format";
import { accountMessages } from "@/lib/i18n/ns/account";
import { getI18n } from "@/lib/i18n/server";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const store = await readStore();
  const monthly = await monthlyLeaderboard();
  const { locale } = await getI18n();
  const a = accountMessages[locale];
  const t = a.leaderboard;
  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted" data-quiz-attempts={store.quizAttempts.length}>
        {t.lead}
      </p>
      <div className="grid two">
        {monthly.length === 0 ? <p>{t.empty}</p> : null}
        {monthly.map((row, index) => (
          <article className="card" key={row.userId}>
            <span className="badge">#{index + 1}</span>
            <h2>{row.name}</h2>
            <p>{fmt(t.xpMonth, { n: row.xp })}</p>
            <p>🔥 {fmt(t.streakDays, { n: row.streakDays })}</p>
            <p className="muted">
              {row.badges.map((id) => a.badges[id]?.title).filter(Boolean).join(" · ") || t.noBadges}
            </p>
          </article>
        ))}
      </div>
      <section className="card" style={{ marginBlockStart: 20 }}>
        <h2>{t.lessonsTitle}</h2>
        <p className="muted">{fmt(t.lessonsCount, { n: academyLessons.length })}</p>
      </section>
    </main>
  );
}
