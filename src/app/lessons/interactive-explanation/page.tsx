import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { getMathQuery } from "@/lib/solver";
import { attachDemoMedia } from "@/lib/solver/assemble";
import { getHeyGenJob, resolveJobTimeline } from "@/lib/studio/heygenJobs";
import { officialExamFourPhaseLesson } from "@/lib/studio/seedLesson";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InteractiveExplanationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; job?: string }>;
}) {
  const { id, job: jobId } = await searchParams;
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  const query = id ? await getMathQuery(id) : undefined;
  if (id && !query) {
    return (
      <main className="shell">
        <p>Explanation not found.</p>
        <Link href="/math-solver">Back to solver</Link>
      </main>
    );
  }
  if (query && live.ok && !staff && query.userId !== live.user.id) {
    return (
      <main className="shell">
        <p>This explanation belongs to another student.</p>
      </main>
    );
  }
  const job = jobId ? await getHeyGenJob(jobId) : query?.heygenJobId ? await getHeyGenJob(query.heygenJobId) : undefined;

  const timeline = query
    ? attachDemoMedia(query.timeline, job?.videoUrl || query.videoUrl || DEMO_AVATAR_VIDEO, job?.id)
    : job
      ? resolveJobTimeline(job)
      : officialExamFourPhaseLesson;

  const viewer = live.ok ? { name: live.user.name, phone: live.user.phone } : { name: "طالب المنصة", phone: "76532421" };

  return (
    <main className="shell studio-shell">
      <p className="eyebrow">Interactive explanation · Prof. Munzer Haddara / الأستاذ منذر حداره</p>
      <h1>{query ? query.topic || query.question : "Avatar + math canvas"}</h1>
      <p className="muted">
        Split player: HeyGen (or demo) video on one side, KaTeX / Function Plot canvas driven by <code>video.currentTime</code>.
        Pause and rewind; the board rebuilds.{" "}
        {query ? <Link href={`/math-solver/result/${query.id}`}>Solution sheet</Link> : <Link href="/math-solver">Solver</Link>}
      </p>
      {query ? (
        <p className="muted">
          {query.finalAnswer} · video {query.videoStatus}
          {query.warning ? ` · ${query.warning}` : ""}
        </p>
      ) : null}
      <InteractiveLessonPlayer timeline={timeline} teacherMode={false} canTeach={Boolean(staff)} viewer={viewer} />
    </main>
  );
}
