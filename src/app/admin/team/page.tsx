import Link from "next/link";
import { TeamChat } from "@/components/admin/team/TeamChat";
import "@/components/admin/team/teamChat.css";
import { requireStaff } from "@/lib/auth/guards";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const live = await requireStaff("/admin/team");
  const { locale } = await getI18n();
  const t = adminMessages[locale].pages;
  return (
    <main className="shell team-page">
      <p className="eyebrow">{t.teamEyebrow}</p>
      <h1>{t.teamTitle}</h1>
      <p className="muted">
        {t.teamLead} <Link href="/admin/team-health">{t.linkTeamHealth}</Link> · <Link href="/admin/team-pr-drafts">{t.linkTeamPrDrafts}</Link> · <Link href="/admin/deployments">{t.linkDeployments}</Link> · <Link href="/admin/agent-hub">Agent Hub</Link> · <Link href="/admin">{t.backToAdmin}</Link>
      </p>
      <TeamChat staffName={live.user.name} />
    </main>
  );
}
