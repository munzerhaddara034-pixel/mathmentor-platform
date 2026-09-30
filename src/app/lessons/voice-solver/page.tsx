import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { PageWatermark } from "@/components/studio/IdentityWatermark";
import { MixedMathText } from "@/components/studio/MixedMathText";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { getVoiceJob } from "@/lib/voiceMath";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { lessonsMessages } from "@/lib/i18n/ns/lessons";

export const dynamic = "force-dynamic";

export default async function VoiceSolverStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const { locale, m } = await getI18n();
  const t = lessonsMessages[locale];
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  const job = id ? await getVoiceJob(id) : undefined;
  const viewer = live.ok
    ? { name: live.user.name, phone: live.user.phone }
    : { name: m.result.watermarkGuest, phone: "76532421" };

  if (!id) {
    return (
      <main className="shell">
        <p>{t.pickVoice}</p>
        {staff ? <Link href="/studio/voice-solver">{t.openTeacherTool}</Link> : null}
      </main>
    );
  }

  if (!job) {
    return (
      <main className="shell">
        <p>{t.voiceNotFound}</p>
        <Link href="/lessons/interactive">{t.board}</Link>
      </main>
    );
  }

  if (live.ok && !staff && job.userId !== live.user.id && !job.studentEnabled) {
    return (
      <main className="shell">
        <p>{t.notLinked}</p>
      </main>
    );
  }

  return (
    <main className="shell studio-shell relative-watermark">
      <PageWatermark name={viewer.name} phone={viewer.phone} />
      <p className="eyebrow">
        {t.voiceEyebrow} · {m.persona.name}
      </p>
      <MixedMathText as="h1" text={job.question} />
      <p className="muted">
        {t.voiceLead} {job.finalAnswer}
        {staff ? (
          <>
            {" · "}
            <Link href={`/studio/voice-solver?id=${encodeURIComponent(job.id)}`}>{t.teacherEdit}</Link>
          </>
        ) : null}
      </p>
      <InteractiveLessonPlayer timeline={job.timeline} teacherMode={false} canTeach={Boolean(staff)} viewer={viewer} />
    </main>
  );
}
