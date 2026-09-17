import { SolverResultView } from "@/components/solver/SolverResultView";
import { PageWatermark } from "@/components/studio/IdentityWatermark";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { getMathQuery } from "@/lib/solver";
import { getHeyGenJob } from "@/lib/studio/heygenJobs";
import { attachDemoMedia } from "@/lib/solver/assemble";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SolverResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = await getMathQuery(id);
  if (!query) notFound();
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  if (live.ok && !staff && query.userId !== live.user.id) notFound();
  const job = query.heygenJobId ? await getHeyGenJob(query.heygenJobId) : undefined;
  const timeline = attachDemoMedia(query.timeline, job?.videoUrl || query.videoUrl || DEMO_AVATAR_VIDEO, job?.id);
  const viewer = live.ok ? { name: live.user.name, phone: live.user.phone } : { name: "طالب المنصة", phone: "76532421" };

  return (
    <main className="shell studio-shell relative-watermark">
      <PageWatermark name={viewer.name} phone={viewer.phone} />
      <p className="eyebrow">Solution · Prof. Munzer Haddara</p>
      <p className="muted">
        <Link href="/math-solver">← New question</Link>
        {" · "}
        <Link href={`/lessons/interactive-explanation?id=${query.id}`}>Split player</Link>
      </p>
      <SolverResultView initial={{ ...query, timeline }} viewer={viewer} canTeach={Boolean(staff)} />
    </main>
  );
}
