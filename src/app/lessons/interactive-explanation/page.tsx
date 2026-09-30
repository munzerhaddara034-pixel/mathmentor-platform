import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { PageWatermark } from "@/components/studio/IdentityWatermark";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { getMathQuery } from "@/lib/solver";
import { attachDemoMedia } from "@/lib/solver/assemble";
import { getHeyGenJob, resolveJobTimeline } from "@/lib/studio/heygenJobs";
import { officialExamFourPhaseLesson } from "@/lib/studio/seedLesson";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { lessonsMessages } from "@/lib/i18n/ns/lessons";

export const dynamic = "force-dynamic";

export default async function InteractiveExplanationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; job?: string }>;
}) {
  const { id, job: jobId } = await searchParams;
  const { locale, m } = await getI18n();
  const t = lessonsMessages[locale];
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  const query = id ? await getMathQuery(id) : undefined;
  if (id && !query) {
    return (
      <main className="shell">
        <p>{t.explanationNotFound}</p>
        <Link href="/math-solver">{t.backToSolver}</Link>
      </main>
    );
  }
  if (query && live.ok && !staff && query.userId !== live.user.id) {
    return (
      <main className="shell">
        <p>{t.otherStudent}</p>
      </main>
    );
  }
  const job = jobId ? await getHeyGenJob(jobId) : query?.heygenJobId ? await getHeyGenJob(query.heygenJobId) : undefined;

  const timeline = query
    ? attachDemoMedia(query.timeline, job?.videoUrl || query.videoUrl || DEMO_AVATAR_VIDEO, job?.id)
    : job
      ? resolveJobTimeline(job)
      : officialExamFourPhaseLesson;

  const viewer = live.ok ? { name: live.user.name, phone: live.user.phone } : { name: m.result.watermarkGuest, phone: "76532421" };

  return (
    <main className="shell studio-shell relative-watermark">
      <PageWatermark name={viewer.name} phone={viewer.phone} />
      <p className="eyebrow">{t.explanationEyebrow}</p>
      <h1 dir="auto">{query ? query.topic || query.question : t.explanationTitle}</h1>
      <p className="muted">
        {t.explanationLead}{" "}
        {query ? <Link href={`/math-solver/result/${query.id}`}>{t.solutionSheet}</Link> : <Link href="/math-solver">{t.solveProblem}</Link>}
      </p>
      {query ? (
        <p className="muted" dir="auto">
          {query.finalAnswer}
          {staff ? ` · video ${query.videoStatus}${query.warning ? ` · ${query.warning}` : ""}` : ""}
        </p>
      ) : null}
      <InteractiveLessonPlayer timeline={timeline} teacherMode={false} canTeach={Boolean(staff)} viewer={viewer} />
    </main>
  );
}
