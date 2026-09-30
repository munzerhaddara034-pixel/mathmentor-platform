import { B2bManager } from "@/components/admin/b2b/B2bManager";
import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import { whishTransferNameAr, whishTransferPhone } from "@/lib/whish/client";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function B2bManagerPage() {
  const phone = whishTransferPhone();
  const nameAr = whishTransferNameAr();
  const { locale } = await getI18n();
  const t = adminMessages[locale].pages;

  return (
    <main className="shell b2b-manager-page mm-mobile-stack">
      <p className="eyebrow">
        {t.b2bEyebrow} · {t.academy}
      </p>
      <h1>{t.b2bTitle}</h1>
      <p className="muted">
        {rich(t.b2bLead, {
          name: locale === "ar" ? INSTRUCTOR_AR : INSTRUCTOR_EN,
          phone: <strong dir="ltr">{phone}</strong>,
          walletName: locale === "ar" ? nameAr : "Munzer Ahmad Haddara",
        })}{" "}
        <Link href="/admin">{t.backToAdmin}</Link>
        {" · "}
        <code>docs/B2B_OPS.md</code>
      </p>
      <B2bManager walletPhone={phone} walletNameAr={nameAr} />
    </main>
  );
}
