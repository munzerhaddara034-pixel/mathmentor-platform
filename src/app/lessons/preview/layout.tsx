import { requireStaff } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

/**
 * Lesson-video player preview: staff (teacher/admin) only, and deliberately NOT linked from any student
 * navigation. Students hitting the URL are redirected by requireStaff. Do not link it until Munzer approves.
 */
export default async function LessonPreviewLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("/lessons/preview");
  return <>{children}</>;
}
