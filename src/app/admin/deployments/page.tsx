import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { Deployments } from "@/components/admin/Deployments";

export const dynamic = "force-dynamic";

export default async function AdminDeploymentsPage() {
  await requireStaff("/admin/deployments");
  const { locale } = await getI18n();
  const t = adminMessages[locale].pages;
  return <main className="shell team-page"><p className="eyebrow">{t.deployments.eyebrow}</p><h1>{t.deployments.title}</h1><p className="muted">{t.deployments.lead} <Link href="/admin/team-pr-drafts">{t.linkTeamPrDrafts}</Link> · <Link href="/admin">{t.backToAdmin}</Link></p><Deployments /></main>;
}
