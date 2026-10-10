import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { TeamPrDrafts } from "@/components/admin/team/TeamPrDrafts";
export const dynamic = "force-dynamic";
export default async function AdminTeamPrDraftsPage() {
  await requireStaff("/admin/team-pr-drafts"); const { locale } = await getI18n(); const t = adminMessages[locale].pages;
  return <main className="shell team-page"><p className="eyebrow">{t.teamPrDraftsEyebrow}</p><h1>{t.teamPrDraftsTitle}</h1><p className="muted">{t.teamPrDraftsLead} <Link href="/admin/team">{t.linkTeam}</Link> · <Link href="/admin/team-health">{t.linkTeamHealth}</Link> · <Link href="/admin">{t.backToAdmin}</Link></p><TeamPrDrafts /></main>;
}
