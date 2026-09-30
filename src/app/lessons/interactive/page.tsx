import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { PageWatermark } from "@/components/studio/IdentityWatermark";
import { officialExamFourPhaseLesson } from "@/lib/studio/seedLesson";
import { getHeyGenJob, resolveJobTimeline, timelineForStudentLesson } from "@/lib/studio/heygenJobs";
import { getStudioEvents } from "@/lib/studio/studioEventsStore";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { lessonsMessages } from "@/lib/i18n/ns/lessons";
import { rich } from "@/lib/i18n/rich";
import { MathInline } from "@/components/ui/MathInline";

export const dynamic = "force-dynamic";

export default async function InteractiveLessonDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; teacher?: string; admin?: string }>;
}) {
  const { job: jobId, teacher, admin } = await searchParams;
  const { locale, m } = await getI18n();
  const t = lessonsMessages[locale];
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
    : { name: m.result.watermarkGuest, phone: "76532421" };

  return (
    <main className="shell studio-shell relative-watermark">
      <PageWatermark name={viewer.name} phone={viewer.phone} />
      {staff ? (
        <details className="studio-lesson-notes" dir="ltr" lang="en">
          <summary>{t.staffNotes}</summary>
          <p className="muted">
            Official exam pattern: complete Terminale study of <code>f(x)=(x-1)e^x</code> — Key Idea, domain D_f,
            limits with <code>y=0</code>, derivative, table of variations, timed graph of C_f, boxed exercise{" "}
            <code>f(x)=−1/2</code> (IVT after continuity + monotonicity), common pitfalls. Editor:{" "}
            <Link href="/studio/script">/studio/script</Link>
            {" · "}
            <Link href="/studio/player?lesson=leb-term-func-01">3-scene seed</Link>
            {" · "}
            <Link href="/studio/player?lesson=complex">Complex numbers</Link>
            {" · "}
            <Link href="/admin/video-generator">HeyGen generator</Link>
            {" · "}
            <Link href="/lessons/interactive?teacher=1">teacher timeline</Link>
            {" · "}
            <Link href="/studio/voice-solver">{t.recordVoice}</Link>
            {timeline.media?.videoUrl ? " · canvas follows video.currentTime" : ""}
            {timeline.media?.studentEnabled ? " · enabled for students" : ""}
          </p>
        </details>
      ) : null}
      <InteractiveLessonPlayer
        timeline={timeline}
        initialLanguage="en"
        teacherMode={teacherMode}
        canTeach={Boolean(staff)}
        viewer={viewer}
      />
      <p className="studio-intro">{rich(t.interactiveIntro, { tex: <MathInline tex="f(x)=(x-1)e^{x}" /> })}</p>
    </main>
  );
}
