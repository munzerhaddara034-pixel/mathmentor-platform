import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { officialExamFourPhaseLesson } from "@/lib/studio/seedLesson";
import { getHeyGenJob, resolveJobTimeline, timelineForStudentLesson } from "@/lib/studio/heygenJobs";
import { getStudioEvents } from "@/lib/studio/studioEventsStore";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InteractiveLessonDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; teacher?: string; admin?: string }>;
}) {
  const { job: jobId, teacher, admin } = await searchParams;
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  const job = jobId ? await getHeyGenJob(jobId) : undefined;
  const base = job
    ? resolveJobTimeline(job)
    : await timelineForStudentLesson("leb-term-func-01", officialExamFourPhaseLesson);
  const overlay = await getStudioEvents(base.id);
  const timeline = overlay ? { ...base, events: overlay } : base;
  const teacherMode = Boolean(staff && (teacher === "1" || admin === "1"));
  const viewer = live.ok
    ? { name: live.user.name, phone: live.user.phone }
    : { name: "طالب المنصة", phone: "76532421" };

  return (
    <main className="shell studio-shell">
      <p className="eyebrow">Classroom studio · protected lesson</p>
      <p className="muted">
        Official exam pattern: complete Terminale study of <code>f(x)=(x-1)e^x</code> — domain, justified limits,
        product rule, table of variation, timed graph, in-video MCQ at 2:18, exercise <code>f(x)=−1/2</code>, exam trap.
        English default, live French toggle. Prof. Munzer Haddara / الأستاذ منذر حداره. Editor:{" "}
        <Link href="/studio/script">/studio/script</Link>
        {" · "}
        <Link href="/studio/player?lesson=leb-term-func-01">3-scene seed</Link>
        {" · "}
        <Link href="/studio/player?lesson=complex">Complex numbers</Link>
        {" · "}
        <Link href="/admin/video-generator">HeyGen generator</Link>
        {staff ? (
          <>
            {" · "}
            <Link href="/lessons/interactive?teacher=1">teacher timeline</Link>
          </>
        ) : null}
        {timeline.media?.videoUrl ? " · HeyGen / placeholder video attached (canvas follows video.currentTime)" : ""}
        {timeline.media?.studentEnabled ? " · enabled for students" : ""}
        {" · canvas left / video right (video on top on phones; swap or fullscreen on mobile) · chapters under the video"}
      </p>
      <InteractiveLessonPlayer
        timeline={timeline}
        initialLanguage="en"
        teacherMode={teacherMode}
        canTeach={Boolean(staff)}
        viewer={viewer}
      />
    </main>
  );
}
