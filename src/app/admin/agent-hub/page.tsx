import Link from "next/link";
import { AgentHub } from "@/components/admin/agent/AgentHub";
import { INSTRUCTOR_AR, INSTRUCTOR_EN, ACADEMY_LINE } from "@/lib/pedagogy/lebanese";

export const dynamic = "force-dynamic";

export default function AgentHubPage() {
  return (
    <main className="shell agent-hub-page">
      <p className="eyebrow">Ops Agent · {ACADEMY_LINE}</p>
      <h1 dir="rtl" lang="ar">
        مركز الوكيل الذاتي · Agent Hub
      </h1>
      <p className="muted">
        Autonomous Operations & Growth for {INSTRUCTOR_EN} / {INSTRUCTOR_AR}. Voice → intent → HeyGen /
        school reports / health.{" "}
        <Link href="/admin">/admin</Link> · <code>docs/AGENT_OPS.md</code>.
      </p>
      <AgentHub />
    </main>
  );
}
