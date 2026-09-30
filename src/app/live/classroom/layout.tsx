import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

/**
 * Classroom access is decided per room in the page (account session or signed guest link),
 * because guests who paid via Whish have no account. AI features inside the room still
 * enforce userHasAiAccess on their own API routes.
 */
export default function LiveClassroomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
