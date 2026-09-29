import { AuthClientGuard } from "@/components/auth/AuthClientGuard";
import { requireAiAccess } from "@/lib/auth/guards";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;
export const dynamic = "force-dynamic";

export default async function ExamsLayout({ children }: { children: React.ReactNode }) {
  await requireAiAccess("/exams");
  return (
    <>
      <AuthClientGuard mode="ai" />
      {children}
    </>
  );
}
