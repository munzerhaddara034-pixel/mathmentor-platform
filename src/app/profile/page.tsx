import { getLiveSession } from "@/lib/auth/session";
import { BADGE_META, getProfile } from "@/lib/gamification/store";
import { walletSnapshot } from "@/lib/billing/store";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const live = await getLiveSession();
  if (!live.ok) redirect("/login?next=/profile");
  const profile = await getProfile(live.user.id, live.user.name);
  const wallet = await walletSnapshot(live.user.id);
  return (
    <main className="shell">
      <p className="eyebrow">Student profile</p>
      <h1>
        {live.user.name} · {live.user.phone}
      </h1>
      <p className="muted">{live.user.email}</p>
      <div className="grid three">
        <article className="card">
          <h2>🔥 {profile.streakDays} Days Streak</h2>
          <p className="muted">Asia/Beirut calendar. Lesson views and AI solves count.</p>
        </article>
        <article className="card">
          <h2>{profile.xp} XP</h2>
          <p className="muted">Lifetime · see the monthly board on /leaderboard</p>
        </article>
        <article className="card">
          <h2>{wallet?.liveCredits ?? live.user.liveCredits} live hours</h2>
          <p>
            AI: {wallet?.aiStatus ?? "—"}. <Link href="/wallet">Wallet</Link>
          </p>
        </article>
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>Badges</h2>
        <div className="row">
          {profile.badges.map((id) => (
            <span className="badge" key={id} title={BADGE_META[id].blurb}>
              {BADGE_META[id].title} · {BADGE_META[id].titleAr}
            </span>
          ))}
          {profile.badges.length === 0 ? <p className="muted">Solve, watch, or sit an exam to earn badges.</p> : null}
        </div>
      </section>
    </main>
  );
}
