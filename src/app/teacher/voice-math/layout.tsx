import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireStaff } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function TeacherVoiceMathLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("/teacher/voice-math");
  return (
    <>
      <AuthClientGuard mode="staff" />
      {children}
    </>
  );
}
