import { AdminConsole } from "@/components/admin/AdminConsole";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { opsMessages } from "@/lib/i18n/ns/ops";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { isVerifiedAdmin } from "@/lib/payments/http";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const live = await requireStaff("/admin");
  const { locale } = await getI18n();
  const t = adminMessages[locale].pages;
  const links = [
    { href: "/admin/video-generator", label: t.linkVideo },
    { href: "/studio/voice-solver", label: t.linkVoice },
    { href: "/admin/exams", label: t.linkExams },
    { href: "/admin/agent-hub", label: t.linkAgent },
    { href: "/admin/team", label: t.linkTeam },
    { href: "/admin/ops", label: opsMessages[locale].pages.opsTitle },
    { href: "/admin/b2b-manager", label: t.linkB2b },
    { href: "/dashboard", label: t.linkCodes },
    ...(isVerifiedAdmin(live.user) ? [{ href: "/admin/payments", label: t.linkPayments }] : []),
  ];
  return (
    <main className="shell">
      <p className="eyebrow">{t.adminEyebrow}</p>
      <h1>{t.adminTitle}</h1>
      <p className="muted">
        {t.adminLead}{" "}
        {links.map((link, index) => (
          <span key={link.href}>
            {index > 0 ? " · " : null}
            <Link href={link.href}>{link.label}</Link>
          </span>
        ))}
      </p>
      <AdminConsole />
    </main>
  );
}
