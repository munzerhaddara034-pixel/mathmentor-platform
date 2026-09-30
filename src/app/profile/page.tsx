import Link from "next/link";
import { redirect } from "next/navigation";
import { findUserById } from "@/lib/auth/db";
import { getFreshSession } from "@/lib/auth/server";
import { getLiveSession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";
import { walletSnapshot } from "@/lib/billing/store";
import { getProfile } from "@/lib/gamification/store";
import { fmt } from "@/lib/i18n/format";
import { accountMessages } from "@/lib/i18n/ns/account";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

async function linkedStudentFor(user: SessionUser): Promise<SessionUser | null> {
  if (!user.linkedStudentId) return null;
  try {
    return (await findUserById(user.linkedStudentId)) ?? null;
  } catch {
    return null;
  }
}

function aiLabel(status: string | undefined, labels: { active: string; expired: string; none: string }): string {
  if (status === "active" || status === "expired" || status === "none") return labels[status];
  return "—";
}

export default async function ProfilePage() {
  const live = await getLiveSession();
  const user = await getFreshSession();
  if (!live.ok || !user) redirect("/login?next=/profile");
  const linked = await linkedStudentFor(user);
  const profile = await getProfile(live.user.id, live.user.name);
  const wallet = await walletSnapshot(live.user.id);
  const { locale, m } = await getI18n();
  const a = accountMessages[locale];
  const t = a.profile;
  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <section className="card profile-card">
        <div className="dash-hero">
          <div>
            <h1>{user.name}</h1>
            <p className="muted" dir="auto">
              {user.email}
              {live.user.phone ? ` · ${live.user.phone}` : ""}
            </p>
          </div>
          <span className="role-badge large">{m.auth.roles[user.role]}</span>
        </div>
        {user.role === "parent" ? (
          <p className="welcome-banner">
            {t.linkedStudent} {linked ? `${linked.name} · ${linked.email}` : t.notLinked}
          </p>
        ) : null}
        {user.role === "student" && user.track ? <p className="muted">
            {t.defaultTrack} {user.track}
          </p> : null}
        <div className="row">
          <Link className="btn dark" href="/dashboard">
            {t.dashboard}
          </Link>
          <Link className="ghost-btn ink" href="/classroom">
            {t.classroom}
          </Link>
          <Link className="ghost-btn ink" href="/wallet">
            {t.wallet}
          </Link>
        </div>
      </section>
      <div className="grid three" style={{ marginBlockStart: 20 }}>
        <article className="card">
          <h2>🔥 {fmt(t.streak, { n: profile.streakDays })}</h2>
          <p className="muted">{t.streakLead}</p>
        </article>
        <article className="card">
          <h2>{profile.xp} XP</h2>
          <p className="muted">{t.xpLead}</p>
        </article>
        <article className="card">
          <h2>{fmt(t.liveHours, { n: wallet?.liveCredits ?? live.user.liveCredits })}</h2>
          <p>
            {t.ai} {aiLabel(wallet?.aiStatus, t.aiStatus)} · <Link href="/wallet">{t.wallet}</Link>
          </p>
        </article>
      </div>
      <section className="card" style={{ marginBlockStart: 20 }}>
        <h2>{t.badges}</h2>
        <div className="row">
          {profile.badges.map((id) => (
            <span className="badge" key={id} title={a.badges[id].blurb}>
              {a.badges[id].title}
            </span>
          ))}
          {profile.badges.length === 0 ? <p className="muted">{t.noBadges}</p> : null}
        </div>
      </section>
    </main>
  );
}
