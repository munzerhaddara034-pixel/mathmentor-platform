import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { PageWatermark } from "@/components/studio/IdentityWatermark";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { getVoiceJob } from "@/lib/voiceMath";
import { INSTRUCTOR_LINE } from "@/lib/pedagogy/lebanese";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VoiceSolverStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  const job = id ? await getVoiceJob(id) : undefined;
  const viewer = live.ok
    ? { name: live.user.name, phone: live.user.phone }
    : { name: "طالب المنصة", phone: "76532421" };

  if (!id) {
    return (
      <main className="shell">
        <p>اختر شرحاً صوتياً مرتبطاً بدرس.</p>
        {staff ? <Link href="/studio/voice-solver">فتح أداة الأستاذ</Link> : null}
      </main>
    );
  }

  if (!job) {
    return (
      <main className="shell">
        <p>Voice explanation not found.</p>
        <Link href="/lessons/interactive">السبورة</Link>
      </main>
    );
  }

  if (live.ok && !staff && job.userId !== live.user.id && !job.studentEnabled) {
    return (
      <main className="shell">
        <p>This explanation is not linked for students yet.</p>
      </main>
    );
  }

  return (
    <main className="shell studio-shell relative-watermark">
      <PageWatermark name={viewer.name} phone={viewer.phone} />
      <p className="eyebrow">Voice explanation · {INSTRUCTOR_LINE}</p>
      <h1>{job.question}</h1>
      <p className="muted">
        Canvas follows the teacher recording when audio is attached. {job.finalAnswer}
        {staff ? (
          <>
            {" · "}
            <Link href={`/studio/voice-solver?id=${encodeURIComponent(job.id)}`}>تعديل الأستاذ</Link>
          </>
        ) : null}
      </p>
      <InteractiveLessonPlayer timeline={job.timeline} teacherMode={false} canTeach={Boolean(staff)} viewer={viewer} />
    </main>
  );
}
