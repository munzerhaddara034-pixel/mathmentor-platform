import { AdminConsole } from "@/components/admin/AdminConsole";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminAuditPage() {
  return (
    <main className="shell">
      <p className="eyebrow">Teacher audit · Prof. Munzer Haddara</p>
      <h1>رقابة الحلول</h1>
      <p className="muted">
        Live AI query log, student ratings, verify / needs-fix notes, and hardest-topic stats.{" "}
        <Link href="/admin">Full admin</Link>
      </p>
      <AdminConsole initialTab="audit" />
    </main>
  );
}
