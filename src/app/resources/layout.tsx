import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireLessonAccess } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function ResourcesLayout({ children }: { children: React.ReactNode }) {
  await requireLessonAccess("/resources");
  return (
    <>
      <AuthClientGuard mode="lesson" />
      {children}
    </>
  );
}
