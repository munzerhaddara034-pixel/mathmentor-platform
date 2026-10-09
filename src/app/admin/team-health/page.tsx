import Link from "next/link";
import { TeamHealth } from "@/components/admin/team/TeamHealth";
import { requireStaff } from "@/lib/auth/guards";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminTeamHealthPage() {
  await requireStaff("/admin/team-health");
  const { locale } = await getI18n();
  const t = adminMessages[locale].pages;
  return (
    <main className="shell team-page">
      <p className="eyebrow">{t.teamHealthEyebrow}</p>
      <h1>{t.teamHealthTitle}</h1>
      <p className="muted">
        {t.teamHealthLead} <Link href="/admin/team">{t.linkTeam}</Link> · <Link href="/admin">{t.backToAdmin}</Link>
      </p>
      <TeamHealth />
    </main>
  );
}
