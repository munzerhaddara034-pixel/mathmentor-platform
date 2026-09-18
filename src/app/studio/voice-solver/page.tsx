import { VoiceMathStudio } from "@/components/voice/VoiceMathStudio";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { getVoiceJob } from "@/lib/voiceMath";
import { ACADEMY_LINE, INSTRUCTOR_LINE } from "@/lib/pedagogy/lebanese";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VoiceSolverStudioPage({
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

  return (
    <main className="shell studio-shell">
      <p className="eyebrow">Voice-to-Math · {ACADEMY_LINE}</p>
      <h1>الموظف الذكي للشرح الصوتي</h1>
      <p className="muted">
        Record an Arabic/English math explanation. Whisper → LaTeX → Lebanese official canvas (Key Idea → D_f →
        limits → f′ / variation → C_f → boxed answers). Instructor: {INSTRUCTOR_LINE}.{" "}
        <Link href="/lessons/interactive?teacher=1">السبورة الذكية</Link>
        {" · "}
        <Link href="/admin/video-generator">HeyGen</Link>
        {" · "}
        <Link href="/dashboard">لوحة الأستاذ</Link>
      </p>
      <VoiceMathStudio initialJob={job ?? null} canTeach={Boolean(staff)} viewer={viewer} />
    </main>
  );
}
