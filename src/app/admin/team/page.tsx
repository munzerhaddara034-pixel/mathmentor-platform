import Link from "next/link";
import { TeamChat } from "@/components/admin/team/TeamChat";
import "@/components/admin/team/teamChat.css";
import { requireStaff } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const live = await requireStaff("/admin/team");
  return (
    <main className="shell team-page" dir="rtl" lang="ar">
      <p className="eyebrow">فريق العمل · الأستاذ منذر حداره / MathMentor</p>
      <h1>دردشة الفريق</h1>
      <p className="muted">
        محمد · سامي · المبرمج — كل Commit يحتاج ضغطك على «موافقة ونشر». <Link href="/admin/agent-hub">Agent Hub</Link> ·{" "}
        <Link href="/admin">الإدارة</Link>
      </p>
      <TeamChat staffName={live.user.name} />
    </main>
  );
}
