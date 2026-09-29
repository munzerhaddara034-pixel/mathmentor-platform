import Link from "next/link";
import { redirect } from "next/navigation";
import { findUserById } from "@/lib/auth/db";
import { getFreshSession } from "@/lib/auth/server";
import { getLiveSession } from "@/lib/auth/session";
import { roleLabel, type SessionUser } from "@/lib/auth/types";
import { walletSnapshot } from "@/lib/billing/store";
import { BADGE_META, getProfile } from "@/lib/gamification/store";

export const dynamic = "force-dynamic";

function linkedStudentFor(user: SessionUser): SessionUser | null {
  if (!user.linkedStudentId) return null;
  try {
    return findUserById(user.linkedStudentId) ?? null;
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  const live = await getLiveSession();
  const user = await getFreshSession();
  if (!live.ok || !user) redirect("/login?next=/profile");
  const linked = linkedStudentFor(user);
  const profile = await getProfile(live.user.id, live.user.name);
  const wallet = await walletSnapshot(live.user.id);
  return (
    <main className="shell">
      <p className="eyebrow">الملف الشخصي</p>
      <section className="card profile-card">
        <div className="dash-hero">
          <div>
            <h1>{user.name}</h1>
            <p className="muted">
              {user.email}
              {live.user.phone ? ` · ${live.user.phone}` : ""}
            </p>
          </div>
          <span className="role-badge large">{roleLabel(user.role)}</span>
        </div>
        {user.role === "parent" ? (
          <p className="welcome-banner">
            الطالب المرتبط: {linked ? `${linked.name} · ${linked.email}` : "غير مربوط بعد"}
          </p>
        ) : null}
        {user.role === "student" && user.track ? <p className="muted">المسار الافتراضي: {user.track}</p> : null}
        <div className="row">
          <Link className="btn dark" href="/dashboard">
            لوحة التحكم
          </Link>
          <Link className="ghost-btn ink" href="/classroom">
            الصف
          </Link>
          <Link className="ghost-btn ink" href="/wallet">
            المحفظة
          </Link>
        </div>
      </section>
      <div className="grid three" style={{ marginTop: 20 }}>
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
