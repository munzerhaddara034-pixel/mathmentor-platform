import { B2bManager } from "@/components/admin/b2b/B2bManager";
import { INSTRUCTOR_LINE, ACADEMY_LINE } from "@/lib/pedagogy/lebanese";
import { whishTransferNameAr, whishTransferPhone } from "@/lib/whish/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function B2bManagerPage() {
  const phone = whishTransferPhone();
  const nameAr = whishTransferNameAr();

  return (
    <main className="shell b2b-manager-page mm-mobile-stack">
      <p className="eyebrow">Admin · B2B · {ACADEMY_LINE}</p>
      <h1 dir="rtl" lang="ar">
        مدير العمليات والشراكات الذكي
      </h1>
      <p className="muted">
        Smart ops & partnerships · {INSTRUCTOR_LINE}. Whish wallet{" "}
        <strong dir="ltr">{phone}</strong> ({nameAr}).{" "}
        <Link href="/admin">← لوحة الإدارة</Link>
        {" · "}
        <code>docs/B2B_OPS.md</code>
      </p>
      <B2bManager walletPhone={phone} walletNameAr={nameAr} />
    </main>
  );
}
