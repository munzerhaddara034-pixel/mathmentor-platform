import { AdminConsole } from "@/components/admin/AdminConsole";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main className="shell">
      <p className="eyebrow">Admin · MathMentor · أكاديمية منذر حداره</p>
      <h1>لوحة الإدارة</h1>
      <p className="muted">
        AI query logs, live session manager, teacher audit, WhatsApp outbox, and student analytics. Video generator remains at{" "}
        <Link href="/admin/video-generator">/admin/video-generator</Link>
        {" · "}
        <Link href="/studio/voice-solver">voice-to-math</Link>
        {" · "}
        <Link href="/admin/exams">exam simulations</Link>
        {" · "}
        <Link href="/dashboard">promo + live-hour codes</Link>
        .
      </p>
      <AdminConsole />
    </main>
  );
}
