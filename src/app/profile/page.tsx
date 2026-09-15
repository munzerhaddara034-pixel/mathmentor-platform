import Link from "next/link";
import { redirect } from "next/navigation";
import { findUserById } from "@/lib/auth/db";
import { getFreshSession } from "@/lib/auth/server";
import { roleLabel } from "@/lib/auth/types";

export default async function ProfilePage() {
  const user = await getFreshSession();
  if (!user) redirect("/login?next=/profile");
  const linked = user.linkedStudentId ? findUserById(user.linkedStudentId) : null;
  return (
    <main className="shell">
      <p className="eyebrow">الملف الشخصي</p>
      <section className="card profile-card">
        <div className="dash-hero">
          <div>
            <h1>{user.name}</h1>
            <p className="muted">{user.email}</p>
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
        </div>
      </section>
    </main>
  );
}
