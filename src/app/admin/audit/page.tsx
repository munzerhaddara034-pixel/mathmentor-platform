import { AdminConsole } from "@/components/admin/AdminConsole";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const { locale } = await getI18n();
  const t = adminMessages[locale].pages;
  return (
    <main className="shell">
      <p className="eyebrow">{t.auditEyebrow}</p>
      <h1>{t.auditTitle}</h1>
      <p className="muted">
        {t.auditLead} <Link href="/admin">{t.fullAdmin}</Link>
      </p>
      <AdminConsole initialTab="audit" />
    </main>
  );
}
