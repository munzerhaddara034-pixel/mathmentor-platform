import Link from "next/link";
import { AgentHub } from "@/components/admin/agent/AgentHub";
import { WhatsAppMediaList } from "@/components/admin/agent/WhatsAppMediaList";
import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import { fmt } from "@/lib/i18n/format";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AgentHubPage() {
  const { locale } = await getI18n();
  const t = adminMessages[locale].pages;
  return (
    <main className="shell agent-hub-page">
      <p className="eyebrow">
        {t.agentEyebrow} · {t.academy}
      </p>
      <h1>{t.agentTitle} · Agent Hub</h1>
      <p className="muted">
        {fmt(t.agentLead, { name: locale === "ar" ? INSTRUCTOR_AR : INSTRUCTOR_EN })} <Link href="/admin">/admin</Link> ·{" "}
        <Link href="/admin/team">{t.agentTeamLink}</Link> · <code>docs/AGENT_OPS.md</code>.
      </p>
      <AgentHub />
      <WhatsAppMediaList />
    </main>
  );
}
