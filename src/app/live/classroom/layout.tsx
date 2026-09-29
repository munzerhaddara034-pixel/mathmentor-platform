import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireAuth } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

/**
 * LiveKit room join: auth only (Whish guests receive a join link after payment).
 * Booking stays public on /live. AI-tier features inside the room (pedagogical tutor /
 * voice-to-board via /api/ai/pedagogical-tutor) still enforce userHasAiAccess (staff exempt).
 */
export default async function LiveClassroomLayout({ children }: { children: React.ReactNode }) {
  await requireAuth("/live");
  return (
    <>
      <AuthClientGuard mode="auth" />
      {children}
    </>
  );
}
