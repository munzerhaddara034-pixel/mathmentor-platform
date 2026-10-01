import { notFound } from "next/navigation";
import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { SolverResultActions } from "@/components/solver/SolverResultActions";
import { SolverThread } from "@/components/solver/SolverThread";
import { PageWatermark } from "@/components/studio/IdentityWatermark";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";
import { TutorOrb } from "@/components/v2/TutorOrb";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { getI18n } from "@/lib/i18n/server";
import { getMathQuery } from "@/lib/solver";
import { attachDemoMedia } from "@/lib/solver/assemble";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";
import { getHeyGenJob } from "@/lib/studio/heygenJobs";
import "@/styles/solver.css";

export const dynamic = "force-dynamic";

export default async function SolverResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = await getMathQuery(id);
  if (!query) notFound();
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  if (live.ok && !staff && query.userId !== live.user.id) notFound();
  const { m, locale } = await getI18n();
  const job = query.heygenJobId ? await getHeyGenJob(query.heygenJobId) : undefined;
  const timeline = attachDemoMedia(query.timeline, job?.videoUrl || query.videoUrl || DEMO_AVATAR_VIDEO, job?.id);
  const viewer = live.ok ? { name: live.user.name, phone: live.user.phone } : { name: m.result.watermarkGuest, phone: "76532421" };

  return (
    <main className="shell mm-solver v2-solver relative-watermark">
      <PageWatermark name={viewer.name} phone={viewer.phone} />
      <header className="v2-solver-head">
        <TutorOrb size={44} />
        <div>
          <div className="v2-persona-line">
            <h1>{m.solver.title}</h1>
            <AiTutorBadge label={m.persona.ai} />
          </div>
          <p className="v2-muted v2-small">{m.solver.subtitle}</p>
        </div>
      </header>
      <SolverThread query={query} m={m} locale={locale} />
      <SolverResultActions
        initial={{ id: query.id, rating: query.rating, needsRetake: query.needsRetake, videoStatus: query.videoStatus, heygenJobId: query.heygenJobId, track: query.track }}
        canTeach={Boolean(staff)}
      />
      {!query.needsRetake ? <InteractiveLessonPlayer timeline={timeline} viewer={viewer} canTeach={Boolean(staff)} /> : null}
    </main>
  );
}
